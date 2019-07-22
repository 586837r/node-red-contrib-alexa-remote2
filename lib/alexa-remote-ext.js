const AlexaRemote = require('alexa-remote2');
const util = require('util');
const tools = require('./common.js');
const known = require('./known-color-values.js');
const convert = require('./color-convert.js');
const deltaE = require('./delta-e.js')
const DEBUG_THIS = tools.DEBUG_THIS;

function requireUncached(mod) {
	delete require.cache[require.resolve(mod)];
	return require(mod);
}

// my own implementation to keep track of the value on errors, for debugging and patching false positives
function promisify(fun) {
	return (function() {
		return new Promise((resolve, reject) => {
			fun.bind(this)(...arguments, (err, val) => {
                if(err) {
                    if(typeof err === 'object') {
                        err.value = val;   
                    }
					reject(err);
                }
				else {
					resolve(val);
                }
			});
		});
	});
}

class AlexaRemoteExt extends AlexaRemote
{
	constructor() {
		super(...arguments);

		// blacklist: ^(?:\t|[ ]{4})(?![A-z]*constructor)[A-z]*\((?![^\)]*callback)[^\)]*\)
		const names = [
			'getSmarthomeDevices', 
			'getSmarthomeEntities', 
			'getSmarthomeGroups',
			'getSmarthomeBehaviourActionDefinitions',
			'discoverSmarthomeDevice',
			'deleteAllSmarthomeDevices',
			'getMusicProviders',
		];
		
		for(const name of names) {
			this[name + 'Promise'] = promisify(this[name]);
		}
	}

	async initExt(config, proxyActiveCallback = () => {}, warnCallback = () => {}) {
		const value = await new Promise((resolve, reject) => this.init(config, (err, val) => {
			if (err) {
				// proxy status message is not the final callback call
				// it is also not an actual error
				// so we filter it out and report it our own way
				const begin = `You can try to get the cookie manually by opening http://`;
				const end = `/ with your browser.`;
				const beginIdx = err.message.indexOf(begin);
				const endIdx = err.message.indexOf(end);
				
				if(beginIdx !== -1 && endIdx !== -1) {
					const url = err.message.substring(begin.length, endIdx);
					proxyActiveCallback(url);
				}
				else {
					reject(err);
				}
			}
			else {
				resolve(this.cookieData);
			}
		}));

		await Promise.all([
			this.initSmarthomeSimplifiedExt(), 
			this.initSmarthomeColorsExt(warnCallback),
			this.initRoutinesExt().catch(error => (error.message = 'could not init routines: ' + error.message, warnCallback(error))),
			this.initAccountExt()
		]);

		return value;
	}

	async initSmarthomeSimplifiedExt() {
		const [groups, entitiesByEntityId, devicesByApplianceId] = await Promise.all([
			this.getSmarthomeGroupsPromise().then(response => response.applianceGroups),
			this.getSmarthomeEntitiesPromise().then(entities => entities.reduce((o,e) => (o[e.id] = e, o), {})),
			this.getSmarthomeDevicesPromise().then(response => {
				const locations = response.locationDetails;
				if(DEBUG_THIS) tools.log({locations: locations}, 1);
	
				const bridges = Object.values(locations).map(location => location.amazonBridgeDetails.amazonBridgeDetails).reduce((o,v) => Object.assign(o,v), {});
				if(DEBUG_THIS) tools.log({bridges: bridges}, 1);
	
				const devices = Object.values(bridges).map(bridge => bridge.applianceDetails.applianceDetails).reduce((o,v) => Object.assign(o,v), {});
				if(DEBUG_THIS) tools.log({devices: devices}, 1);
	
				return devices;
			})
		]);

		this.smarthomeSimplifiedByEntityIdExt = new Map();
		for(const device of Object.values(devicesByApplianceId)) {
			const properties = [];
			for (const capability of device.capabilities) {
				for (const property of capability.properties.supported) {
					properties.push(property.name);
				}
			}

			const entity = entitiesByEntityId[device.entityId] || {};
			// supportedOperations is enough? we don't care about unsupported operations anyway
			//
			// const uniqueActions = new Set();
			// for(const action of device.actions) {
			// 	uniqueActions.add(action);
			// }
			// for(const action of entity.supportedOperations || []) {
			// 	uniqueActions.add(action);
			// }
			// for(const action of entity.supportedProperties || []) {
			// 	uniqueActions.add(action);
			// }

			if(device.applianceTypes[0] === 'OTHER' && device.manufacturerName === 'AMAZON' && device.driverIdentity && device.driverIdentity.namespace === 'AAA') {
				// this is probably an Echo
				device.applianceTypes[0] = 'ECHO';
			}

			// common
			const entry = {};
			entry.entityId = device.entityId;
			entry.applianceId = device.applianceId;
			entry.name = device.friendlyName;
			entry.type = 'APPLIANCE';
			entry.actions = entity.supportedOperations || [];
			entry.properties = properties;
			entry.applianceTypes = device.applianceTypes;
			// entry.actions = Array.from(uniqueActions);

			this.smarthomeSimplifiedByEntityIdExt.set(entry.entityId, entry);
		}
		for(const group of groups) {
			
			const entry = {};

			// group specific
			const applianceIds = group.applianceIds || [];
			const entityIds = applianceIds.map(id => devicesByApplianceId[id] && devicesByApplianceId[id].entityId).filter(x => x);
			entry.children = entityIds.map(id => this.smarthomeSimplifiedByEntityIdExt.get(id)).filter(x => x);

			const uniqueActions = new Set();
			const uniqueProperties = new Set();
			const uniqueTypes = new Set();
			for (const entity of entry.children) {
				for (const action of entity.actions) uniqueActions.add(action);
				for (const property of entity.properties) uniqueProperties.add(property);
				for (const type of entity.applianceTypes) uniqueTypes.add(type);
			}

			// common
			entry.groupId = group.groupId;
			entry.entityId = group.groupId.substr(group.groupId.lastIndexOf('.') + 1);
			entry.name = group.name;
			entry.type = 'GROUP';
			entry.actions = Array.from(uniqueActions);
			entry.properties = Array.from(uniqueProperties);
			entry.applianceTypes = Array.from(uniqueTypes);

			this.smarthomeSimplifiedByEntityIdExt.set(entry.entityId, entry);
		}
	}

	async initSmarthomeColorsExt(warnCallback = () => {}) {
		const definitions = await this.getSmarthomeBehaviourActionDefinitionsPromise();

		//tools.log({simplified: this.smarthomeSimplifiedByEntityId});

		// build color names
		// this is not required to succeed
		let colorNameOptions = [];
		let colorTemperatureNameOptions = [];

		try {
			colorNameOptions = definitions
				.find(x => x.id === 'setColor').parameters
				.find(x => x.name === 'colorName').constraint.options
				.map(option => {
					const hex = known.colorNameToHex[option.data];
					const rgb = hex && convert.hex2rgb(hex);
					const hsv = rgb && convert.rgb2hsv(rgb);
				
					const value = option.data;
					const label = option.displayName;
					//const label = hex ? `${option.displayName} (${hex})` : option.displayName;
				
					// sort by hue but put grayscale at the back
					let sortkey = !hsv ? Infinity : (hsv[1] !== 0) ? hsv[0] : (hsv[2] + 42);
				
					return {
						value: value,
						label: label,
						color: hex,
						sortkey: sortkey
					};
				})
				.sort((a,b) => a.sortkey - b.sortkey);
		}
		catch(error) {
			error.message = 'could not build smarthome color names: ' + error.message;
			warnCallback(error);
		}

		try {
			colorTemperatureNameOptions = definitions
				.find(x => x.id === 'setColorTemperature').parameters
				.find(x => x.name === 'colorTemperatureName').constraint.options
				.map(option => {
					const number = known.colorTemperatureNameToKelvin[option.data];
					const value = option.data;
					const label = option.displayName;
					//const label = number ? `${option.displayName} (${number})` : option.displayName;

					return {
						value: value,
						label: label,
						sortkey: number
					};
				})
				.sort((a,b) => a.sortkey - b.sortkey);
		}
		catch(error) {
			error.message = 'could not build smarthome color temperature names: ' + error.message;
			warnCallback(error);
		}

		this.colorNameToLabelExt = new Map();
		for(const {value, label} of colorNameOptions) {
			this.colorNameToLabelExt.set(value, label);
		}

		this.colorTemperatureNameToLabelExt = new Map();
		for(const {value, label} of colorTemperatureNameOptions) {
			this.colorTemperatureNameToLabelExt.set(value, label);
		}

		this.colorNamesExt = new Set();
		for(const option of colorNameOptions) {
			this.colorNamesExt.add(option.value);
		}

		this.colorNameToHexExt = new Map();
		for(const [name, hex] of known.colorNameToHex) {
			if(this.colorNamesExt.has(name)) {
				this.colorNameToHexExt.set(name, hex);
			}
		}

		this.colorTemperatureNamesExt = new Set();
		for(const option of colorTemperatureNameOptions) {
			this.colorTemperatureNamesExt.add(option.value);
		}

		this.colorTemperatureNameToKelvinExt = new Map();
		for(const [name, kelvin] of known.colorTemperatureNameToKelvin) {
			if(this.colorTemperatureNamesExt.has(name)) {
				this.colorTemperatureNameToKelvinExt.set(name, kelvin);
			}
		}
	}

	async initRoutinesExt() {
		this.routineByIdExt = new Map();
		const routines = await this.getAutomationRoutinesExt();
		this.routineByIdExt = new Map(routines.map(o => [o.automationId, o]));
	}

	async initAccountExt() {
		this.musicProvidersExt = await this.getMusicProvidersPromise();
	}

	async refreshExt() {
		this._options.cookie = this.cookieData;
		delete this._options.csrf;
		return this.initExt(this._options);
	}

	resetExt() {
		this.stop();
		
		if (this.alexaCookie) {
			this.alexaCookie.stopProxyServer();
		}
		if (this.alexaWsMqtt) {
			this.alexaWsMqtt.removeAllListeners();
		}

		this.removeAllListeners();	
	}

	async httpsGetPromise(noCheck, path, flags) {
        if (typeof noCheck !== 'boolean') {
            flags = path;
            path = noCheck;
            noCheck = false;
        }

		return new Promise((resolve, reject) => {
			const callback = (err, val) => err ? reject(err) : resolve(val);
			this.httpsGet(noCheck, path, callback, flags);
		});
	}

	// overrides
	generateCookie(email, password, callback) {
        if (!this.alexaCookie) this.alexaCookie = requireUncached('alexa-cookie2');
        this.alexaCookie.generateAlexaCookie(email, password, this._options, callback);
    }

	// overrides
    refreshCookie(callback) {
        if (!this.alexaCookie) this.alexaCookie = requireUncached('alexa-cookie2');
        this.alexaCookie.refreshAlexaCookie(this._options, callback);
	}

	async getAutomationRoutinesExt(limit = 2000) {
		return this.httpsGetPromise(`/api/behaviors/automations?limit=${limit}`);
	}

	executeAutomationRoutineExt(serialOrName, utteranceOrId, callback) {
		if (typeof utteranceOrId !== 'string') {
			return callback && callback(new Error('utteranceOrId needs to be a string'));
		}

		this.getAutomationRoutines((err, res) => {
			if (err) {
				return callback && callback(err, res);
			}

			let routines = res;
			let routine;

			if (utteranceOrId.match(/amzn1.alexa.automation/)) {
				// is id
				routine = routines.find(r => r.automationId === utteranceOrId);
			}
			else {
				// is utterance
				routine = routines.find(
					routine => routine.triggers.find(
						trigger => trigger.payload.utterance === utteranceOrId));
			}

			if (!routine) {
				return callback && callback(new Error('routine not found'));
			}

			let command = {
				sequence: routine.sequence,
				automationId: routine.automationId,
				status: 'ENABLED',
			};

			this.sendSequenceCommand(serialOrName, command, callback);
		});
	}

	async sendSequenceNodeExt(sequenceNode) {
		const wrapperNode = {
			'@type': 'com.amazon.alexa.behaviors.model.Sequence',
			startNode: sequenceNode
		}

		const requestData = {
			behaviorId: 'PREVIEW',
			sequenceJson: JSON.stringify(wrapperNode),
			status: 'ENABLED',
		}

		//tools.log({sequenceNode: sequenceNode});

		return this.httpsGetPromise(`/api/behaviors/preview`, { 
			method: 'POST', 
			data: JSON.stringify(requestData)
		}).catch(error => {
			if(error.message === 'no body') {
				return null; // false positive
			}
			throw error;
		});
	}

	findSmarthomeEntityExt(id) {
		if(typeof id !== 'string' || !this.smarthomeSimplifiedByEntityIdExt) return undefined;

		// by entityId
		let entity = this.smarthomeSimplifiedByEntityIdExt.get(id);
		if(entity) return entity;	
	
		// by applianceId
		for(const entity of this.smarthomeSimplifiedByEntityIdExt.values()) {
			if(entity.applianceId === id) return entity;
		}

		// by name
		const lowercase = id.toLowerCase();
		for(const entity of this.smarthomeSimplifiedByEntityIdExt.values()) {
			if(entity.name.toLowerCase() === lowercase) return entity;
		}

		return undefined;
	}

	async findSmarthomeEntityExtAsync(id) {
		const entity = findSmarthomeEntityExt(id);
		if(!entity) throw new Error(`smarthome entity not found: "${id}"`);
		return entity;
	}

	findSmarthomeColorNameExt(arg) {
		if(typeof arg !== 'string') return undefined;

		if(!arg.startsWith('#')) {
			if(!this.colorNamesExt.has(arg)) {
				return arg;
			}

			for(const name of this.colorNamesExt) {
				if(tools.alnumEqual(name, arg)) {
					return name;
				}
			}

			return undefined;
		}

		const target = convert.hex2lab(arg);
		let closestDelta = Infinity;
		let closestName = undefined;

		for(const [name, hex] of this.colorNameToHexExt) {
			const lab = convert.hex2lab(hex);
			const delta = deltaE(target, lab);
			if(delta < closestDelta) {
				closestDelta = delta;
				closestName = name;
			}
		}

		return closestName;
	}

	findSmarthomeColorTemperatureNameExt(arg) {
		const type = typeof arg;
		if(type !== 'string' && type !== 'number') return undefined;

		if(type === 'string' && !arg.startsWith('#')) {
			if(!this.colorTemperatureNamesExt.has(arg)) {
				return arg;
			}

			for(const name of this.colorTemperatureNamesExt) {
				if(tools.alnumEqual(name, arg)) {
					return name;
				}
			}

			return undefined;
		}
	
		const number = Number(arg);
		const target = Number.isNaN(number) ? convert.hex2lab(arg) : convert.tmp2lab(number)
		let closestDelta = Infinity;
		let closestName = undefined;

		for(const [name, kelvin] of this.colorTemperatureNameToKelvinExt) {
			const lab = convert.tmp2lab(kelvin);
			const delta = deltaE(target, lab);
			if(delta < closestDelta) {
				closestDelta = delta;
				closestName = name;
			}
		}

		return closestName;
	}

	// requests like ['Lamp 1', '1234-DEAD-BEEF-5678' }]
	async querySmarthomeDevicesExt(requests) {
		const entities = requests.map(request => this.findSmarthomeEntityExt(request.entity));
		const nativeRequests = entities.filter(e => e).map(entity => ({
			entityType: entity.type,
			entityId: entity.applianceId,
		}));

		const response = await querySmarthomeDevicesRawExt(nativeRequests);
		if(!tools.matches(response, {deviceStates: [{}], errors: [{}]}, 2)) {
			throw new Error('unexpected response layout!');
		}

		const states = response.deviceStates;
		const errors = response.errors;

		return [states, errors];
	}

	async querySmarthomeDevicesRawExt(stateRequests) {
		/*
		'stateRequests': [
			{
				'entityId': 'AAA_SonarCloudService_00:17:88:01:04:1D:4C:A0',
				'entityType': 'APPLIANCE'
			}
		]
		*/

		const flags = {
			method: 'POST',
			data: JSON.stringify({
				'stateRequests': stateRequests
			})
		}

		console.log(util.inspect(flags, false, 10, true));
		return this.httpsGetPromise('/api/phoenix/state', flags);
	}

	async executeSmarthomeDeviceActionRawExt(controlRequests) {
		/*
        {
            'controlRequests': [
                {
                    'entityId': 'bbd72582-4b16-4d1f-ab1b-28a9826b6799',
                    'entityType':'APPLIANCE',
                    'parameters':{
                        'action':'turnOn'
                    }
                }
            ]
		}
		*/

		const flags = {
			method: 'PUT',
			data: JSON.stringify({
				'controlRequests': controlRequests
			})
		}

		console.log(util.inspect(flags, false, 10, true));
		return this.httpsGetPromise('/api/phoenix/state', flags);
	}

	async deleteSmarthomeDeviceExt(id) {
		return new Promise((resolve, reject) => {
			const entity = this.findSmarthomeEntityExt(id);
			if(!entity || entity.type !== 'APPLIANCE') throw new Error(`smarthome device not found: "${id}"`);
			this.deleteSmarthomeDevice(entity.applianceId, (err, val) => {
				err && err.message !== 'no body' ? reject(err) : resolve(val);
			});
		});
	}

	async deleteSmarthomeGroupExt(id) {
		return new Promise((resolve, reject) => {
			const entity = this.findSmarthomeEntityExt(id);
			if(!entity || entity.type !== 'GROUP') throw new Error(`smarthome group not found: "${id}"`);
			this.deleteSmarthomeGroup(entity.groupId, (err, val) => {
				err && err.message !== 'no body' ? reject(err) : resolve(val);
			});
		});
	}

	async deleteAllSmarthomeDevicesExt() {
		return new Promise((resolve, reject) => {
			this.deleteAllSmarthomeDevices((err, val) => {
				err && err.message !== 'no body' ? reject(err) : resolve(val);
			});
		});
	}
}

module.exports = AlexaRemoteExt;