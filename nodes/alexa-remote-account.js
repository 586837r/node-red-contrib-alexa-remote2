const util = require('util');
const fs = require('fs');
const EventEmitter = require('events');

const AlexaRemote = require('../lib/alexa-remote.js');
const tools = require('../lib/tools.js');
const knownColorValues = require('../lib/known-color-values.js');
const convert = require('../lib/color-convert');

const DEBUG_THIS = tools.DEBUG_THIS;
const DEBUG_ALEXA_REMOTE2 = tools.DEBUG_ALEXA_REMOTE2;

function accountHttpResponse(RED, property, label, req, res) {
	const account = RED.nodes.getNode(req.query.account);
	console.log(req.url);

	if(!account) {
		res.writeHeader(500, {'Content-Type': 'text/plain'});
		return res.end(`Could not load ${label}: Account missing!`);
	}

	if(!account.initialised) {
		res.writeHeader(500, {'Content-Type': 'text/plain'});
		return res.end(`Could not load ${label}: Account not initialised!`);
	}

	if(!account[property])  {
		res.writeHeader(500, {'Content-Type': 'text/plain'});
		return res.end(`Could not load ${label}: Account not correctly initialised!`);
	}

	res.writeHeader(200, {'Content-Type': 'application/json'});
	res.end(typeof account[property] === 'string' ? account[property] : JSON.stringify(account[property]));
}
module.exports = function (RED) {
	function AlexaRemoteAccountNode(input) {
		RED.nodes.createNode(this, input);

		tools.assign(this, ['authMethod', 'proxyOwnIp', 'proxyPort', 'cookieFile', 'alexaServiceHost', 'amazonPage', 'acceptLanguage', 'userAgent'], input);
		this.useWsMqtt = input.useWsMqtt === 'on';
		this.autoInit  = input.autoInit  === 'on';

		this.alexa = new AlexaRemote();
		this.emitter = new EventEmitter().setMaxListeners(64);
		this.initing = false;
		this.status = { code: 'uninitialized', message: 'uninitialized' }
		this.initialised = false;
		this.initialisationType = null;

		this.smarthomeSimplifiedByEntityId = null;
		this.devicesSimplifiedBySerial = null;
		this.smarthomeForUiJson = null;

		this.colorNames = [];
		this.colorTemperatureNames = [];
		this.nearestColorName = null;
		this.nearestColorTemperatureName = null;

		this._postInit = async function() {
			const entities = await this.alexa.getSmarthomeEntitiesPromise();
			const definitions = await this.alexa.getSmarthomeBehaviourActionDefinitionsPromise();
			const groups = await this.alexa.getSmarthomeGroupsPromise().then(response => response.applianceGroups);
			const devicesByApplianceId = await this.alexa.getSmarthomeDevicesPromise().then(response => {
				const locations = response.locationDetails;
				if(DEBUG_THIS) tools.log({locations: locations}, 2);

				const bridges = Object.values(locations).map(location => location.amazonBridgeDetails.amazonBridgeDetails).reduce((a,b) => Object.assign(a,b), {});
				if(DEBUG_THIS) tools.log({bridges: bridges}, 2);

				const devices = Object.values(bridges).map(bridge => bridge.applianceDetails.applianceDetails).reduce((a,b) => Object.assign(a,b), {});
				if(DEBUG_THIS) tools.log({devices: devices}, 10);

				return devices;
			});

			tools.log({entities: entities});
			const entitiesByEntityId = entities.reduce((o,e) => (o[e.id] = e, o), {});
			tools.log({entitiesByEntityId: entitiesByEntityId});
			const devices = Object.values(devicesByApplianceId);
			
			// build smarthome simplified
			this.smarthomeSimplifiedByEntityId = {};
			for(const device of devices) {
				const properties = [];
				for (const capability of device.capabilities) {
					for (const property of capability.properties.supported) {
						properties.push(property.name);
					}
				}

				const entity = entitiesByEntityId[device.entityId] || {};
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
				entry.applianceTypes = device.applianceTypes;
				entry.properties = properties;
				entry.actions = entity.supportedOperations || [];
				// entry.actions = Array.from(uniqueActions);

				this.smarthomeSimplifiedByEntityId[entry.entityId] = entry;
			}
			for(const group of groups) {
				
				const entry = {};

				// group specific
				entry.applianceIds = group.applianceIds || [];
				entry.entityIds = entry.applianceIds.map(id => devices[id] && devices[id].entityId).filter(x => x);

				const uniqueActions = new Set();
				const uniqueProperties = new Set();
				const uniqueTypes = new Set();
				for (const id of entry.entityIds) {
					const device = this.smarthomeSimplifiedByEntityId[id];
					if(!device) continue;

					for (const action of device.actions) {
						uniqueActions.add(action);
					}

					for (const property of device.properties) {
						uniqueProperties.add(property);
					}

					for(const type of device.types) {
						uniqueTypes.add(type);
					}
				}

				// common
				entry.entityId = group.groupId.substr(group.groupId.lastIndexOf('.') + 1);
				entry.applianceId = entry.entityId;
				entry.name = group.name;
				entry.type = 'GROUP';
				entry.actions = Array.from(uniqueActions);
				entry.properties = Array.from(uniqueProperties);
				entry.applianceTypes = Array.from(uniqueTypes);

				this.smarthomeSimplifiedByEntityId[entry.entityId] = entry;
			}
			tools.log({simplified: this.smarthomeSimplifiedByEntityId});

			// build color names
			// these may be absent
			let colorNameOptions = [];
			let colorTemperatureNameOptions = [];

			try {
				colorNameOptions = definitions
					.find(x => x.id === 'setColor').parameters
					.find(x => x.name === 'colorName').constraint.options
					.map(option => {
						const hex = knownColorValues.colorNames[option.data];
						const rgb = hex && convert.hex2rgb(hex);
						const hsv = rgb && convert.rgb2hsv(rgb);

						const value = option.data;
						const label = hex ? `${option.data} (${hex})` : option.displayName;

						return {
							value:value,
							label:label,
							sortkey: hsv ? hsv[0] : Infinity // to be sorted by this
						};
					})
					//.sort((a,b) => a.sortkey-b.sortkey);
			}
			catch(ex) {
				if(DEBUG_THIS) this.warn('Could not build Color Names: ' + ex.message);
			}

			try {
				colorTemperatureNameOptions = definitions
					.find(x => x.id === 'setColorTemperature').parameters
					.find(x => x.name === 'colorTemperatureName').constraint.options
					.map(option => {
						const number = knownColorValues.colorTemperatureNames[option.data];
						const value = option.data;
						const label = number ? `${option.data} (${number})` : option.displayName;

						return {
							value:value,
							label:label,
							sortkey:number
						};
					})
					//.sort((a,b) => a.sortkey-b.sortkey);
			}
			catch(ex) {
				if(DEBUG_THIS) this.warn('Could not build Color Temperature Names: ' + ex.message);
			}

			this.colorNames = colorNameOptions.map(option => option.value);
			const supportedKnownColorName = Object.entries(knownColorValues.colorNames).filter(([k,v]) => this.colorNames.includes(k)).reduce((o,[k,v]) => (o[k] = v, o), {});
			this.nearestColorName = require('nearest-color').from(supportedKnownColorName);
			
			this.colorTemperatureNames = colorTemperatureNameOptions.map(option => option.value);
			const supportedKnownColorTemperatureName = Object.entries(knownColorValues.colorTemperatureNames).filter(([k,v]) => this.colorTemperatureNames.includes(k)).reduce((o,[k,v]) => (o[k] = v, o), {});
			this.nearestColorTemperatureName = require('nearest-color').from(supportedKnownColorTemperatureName);

			tools.log({nearestColorName: this.nearestColorName});
			tools.log({nearestColorTemperatureName: this.nearestColorTemperatureName});

			// build smarthome for ui
			function applianceTypeToFontAwesomeUnicode(type) {
				switch(type) {
					case 'LIGHT':               return 'f0eb'; // lightbulb-o 
					case 'SWITCH':              return 'f205'; // toggle-on
					case 'THERMOSTAT':          return 'f2c9'; // thermometer-half
					case 'SMARTLOCK':           return 'f084'; // key
					case 'SCENE_TRIGGER':       return 'f144'; // play-circle
					case 'ACTIVITY_TRIGGER':    return 'f0f3'; // bell
					case 'HUB':                 return 'f233'; // server
					case 'ECHO': /*not native*/ return 'f270'; // amazon
					case 'OTHER':               return 'f2db'; // microchip
					default:                    return 'f128'; // question
				}
			}
			function getEntryLabel(entry) {
				if(entry.type === 'APPLIANCE') {
					return entry.applianceTypes.map(applianceTypeToFontAwesomeUnicode).map(c => `&#x${c};`).join('') + `  ${entry.name}`;
				}
				else {
					return `&#x${'f247'};  ${entry.name}`; // object-group
				}
			}
			const smarthomeForUi = {};
			smarthomeForUi.entitiesById = Object.values(this.smarthomeSimplifiedByEntityId)
				.sort((a,b) => {
					if(a.type !== b.type) {
						return a.type === 'APPLIANCE' ? -1 : 1;
					}
					
					const an = a.name.toLowerCase();
					const bn = b.name.toLowerCase();
	
					if (an < bn) {
						return -1;
					} else if (an > bn) {
						return 1;
					}
	
					return 0;	
				})
				.reduce((obj, entry) => (
					obj[entry.entityId] = [
						getEntryLabel(entry),
						entry.properties,
						entry.actions
					],
					obj
				), {});
			smarthomeForUi.colorNames = colorNameOptions.map(option => [option.value, option.label]);
			smarthomeForUi.colorTemperatureNames = colorTemperatureNameOptions.map(option => [option.value, option.label]);

			tools.log({smarthomeForUi: smarthomeForUi}, 10, 250);
			this.smarthomeForUiJson = JSON.stringify(smarthomeForUi);
		}

		this.findSmarthomeEntity = function(id) {
			if(typeof id !== 'string') return null;

			// by entityId
			let entity = this.smarthomeSimplifiedByEntityId && this.smarthomeSimplifiedByEntityId[id];
			if(entity) return entity;	
		
			const values = Object.values(this.smarthomeSimplifiedByEntityId);

			// by applianceId
			entity = values.find(o => o.applianceId === id);
			if(entity) return entity;	

			// by name
			const lowercase = id.toLowerCase();
			entity = values.find(o => (o.name || '').toLowerCase() === lowercase);

			return entity;
		}
		this.findColorName = function(arg) {
			if(typeof arg === 'string' && arg[0] !== '#') {
				//tools.log({'0_message': 'Searching for', '1_arg': arg, '2_colorNames': this.colorNames});
				const found = this.colorNames.find(name => tools.alnumEqual(name, arg));
				// tools.log({found: found});
				if(found) return found;
			}
			
			if(this.nearestColorName) {
				try { return this.nearestColorName(arg).name }
				catch(ex) { }
			}

			return '';
		}
		this.findColorTemperatureName = function(arg) {
			if(typeof arg === 'string') {
				const found = this.colorTemperatureNames.find(name => tools.alnumEqual(name, arg));
				if(found) return found;
			}
			
			if(this.nearestColorTemperatureName) {
				try { return this.nearestColorTemperatureName(arg).name }
				catch(ex) { }
			}

			return '';
		}

		this._status = function(code, message) {
			this.status = {
				code: code,
				message: message || code
			}
			this.emitter.emit('status', code, message);
		}
		this._stopAlexa = function () {
			if (!this.alexa) return;

			if (this.alexa.alexaWsMqtt) {
				this.alexa.alexaWsMqtt.removeAllListeners();
			}
			if (this.alexa.alexaCookie) {
				this.alexa.alexaCookie.stopProxyServer();
			}

			// TODO: is this still necessary?
			delete this.alexa.alexaCookie;

			this.alexa.removeAllListeners();
			this.alexa.stop();
			
			this.initialised = false;
			this._status('stopped')
			this.smarthomeGroups = null;
			this.smarthomeDevices = null;
			this.alexa = new AlexaRemote();
			
			this.initing = false;
		}
		this._initAlexaFromObject = function (input, callback) {
			// start from blank slate
			this._stopAlexa();

			const config = {}
			tools.assign(config, ['proxyOwnIp', 'proxyPort', 'alexaServiceHost', 'amazonPage', 'acceptLanguage', 'userAgent', 'useWsMqtt'], this);

			config.logger = DEBUG_ALEXA_REMOTE2 ? console.log : undefined;
			config.refreshCookieInterval = 0;
			config.proxyLogLevel = 'warn';
			config.cookieJustCreated = true; // otherwise it just tries forever...
			config.bluetooth = false;

			switch (this.authMethod) {
				case 'proxy':
					config.proxyOnly = true; // optional
					break;
				case 'cookie':
					tools.assign(config, ['cookie'], this.credentials);
					break;
				case 'password':
					tools.assign(config, ['email', 'password'], this.credentials);
					break;
			}

			// if input was actually formerRegistrationData
			if(input.loginCookie) {
				input = { formerRegistrationData: input };
			}

			if (input) tools.assign(config, input);
			if (!config.amazonPageProxyLanguage) config.amazonPageProxyLanguage = config.acceptLanguage ? config.acceptLanguage.replace('-', '_') : undefined;

			if(!config.cookie && config.formerRegistrationData) {
				config.cookie = config.formerRegistrationData.localCookie;
			}

			if(config.cookie) {
				if(config.formerRegistrationData){
					this.initialisationType = 'proxy';
				}
				else {
					this.initialisationType = 'cookie';
					
				}
			} 
			else if (config.email && config.password) {
				this.initialisationType = 'password';
			}
			else {
				this.initialisationType = 'proxy';
			}

			switch(this.initialisationType) {
				case 'proxy': this._status('init-proxy'); break;
				case 'cookie': this._status('init-cookie'); break;
				case 'password': this._status('init-password'); break;
			}

			this.alexa.init(config, (err, val) => {
				if (err) {
					// proxy status message is not the final callback call
					const begin = `You can try to get the cookie manually by opening http://`;
					const end = `/ with your browser.`;
					const beginIdx = err.message.indexOf(begin);
					const endIdx = err.message.indexOf(end);
					
					if(beginIdx !== -1 && endIdx !== -1) {
						const url = err.message.substring(begin.length, endIdx);
						const text = `open ${url} in your browser`;
				
						this.warn(text);
						this._status('wait-proxy', text);
						// we dont call callback
					}
					else {
						this.initialised = false;
						this._status('error', err.message);
						callback && callback(err, val);
					}
				}
				else {
					if(this.cookieFile && this.authMethod === 'proxy') {
						const options = this.alexa._options;
						const regData = options && options.formerRegistrationData;
						const string = JSON.stringify(regData);

						fs.writeFile(this.cookieFile, string, 'utf8', (err, val) => {
							if(err) {
								err.warning = true;
								callback && callback(err, val);
							}
						})
					}

					this._postInit()
						.then(val => {
							this.initialised = true;
							this._status('ready');
							callback && callback(null, val);
						})
						.catch(err => {
							this._status('error', err && err.message);
							callback && callback(err);
						});
				}
			});
		}
		this._initAlexaFromObjectOrFile = function (input, callback) {

			if(input.formerRegistrationData || input.loginCookie || this.authMethod !== 'proxy' || !this.cookieFile) {
				return this._initAlexaFromObject(input, callback);
			}

			fs.readFile(this.cookieFile, 'utf8', (err, val) => {
				let obj;
				const config = tools.assign({}, input);

				if(!err) {
					if(obj = tools.tryParseJson(val)) {
						tools.assign(config, obj);
					}
					else {
						err = new Error('file is not json');
						err.warning = true;
						callback && callback(err, val);
					}
				}
				else {
					err.warning = true;
					callback && callback(err, val);
				}

				this._initAlexaFromObject(config, callback);
			})
		}
		this._initAlexaFromObjectOrFileLocked = function(input={}, callback) {
			if (this.initing) {
				const error = new Error('Already initialising');
				error.warning = true;
				return callback && callback(error);
			}

			this.initing = true;
			this._initAlexaFromObjectOrFile(input, (err, val) => {
				this.initing = false;
				callback && callback(err, val);
			});
		}
		this._refreshAlexaCookie = function(callback) {
			if (this.initing) {
				const error = new Error('Already initialising');
				error.warning = true;
				return callback && callback(error);
			}

			this._status('refreshing cookie');
			this.alexa.refreshCookie((err, val) => {
				this.alexa.setCookie(val);
				this._status('ready');
				callback && callback(err, val);
			});
		}

		this.stopAlexa = this._stopAlexa;
		this.initAlexa = this._initAlexaFromObjectOrFileLocked;
		this.refreshAlexaCookie = this._refreshAlexaCookie;

		this.on('close', function () {
			this.stopAlexa();
		});
		
		if(this.autoInit) {
			this.initAlexa(undefined, (err, val) => {
				if(err) {
					this.error(err);
				}
			});
		}
	}

	RED.nodes.registerType("alexa-remote-account", AlexaRemoteAccountNode, {
		credentials: {
			cookie: { type: 'text' },
			email: { type: 'text' },
			password: { type: 'password' },
		}
	});

	RED.httpAdmin.get('/alexa-remote-devices.json', (req, res) => accountHttpResponse(RED, 'devicesSimplified', 'Devices', req, res));
	RED.httpAdmin.get('/alexa-remote-smarthome.json', (req, res) => accountHttpResponse(RED, 'smarthomeForUiJson', 'Smarthome Devices', req, res));
	RED.httpAdmin.get('/alexa-remote-names.json', (req, res) => accountHttpResponse(RED, 'colorNames', 'Color Names', req, res));
}