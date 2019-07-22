const util = require('util');
const fs = require('fs');
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const EventEmitter = require('events');

const AlexaRemote = require('../lib/alexa-remote-ext.js');
const tools = require('../lib/common.js');
const known = require('../lib/known-color-values.js');
const convert = require('../lib/color-convert.js');
const deltaE = require('../lib/delta-e.js')

const DEBUG_THIS = tools.DEBUG_THIS;
const DEBUG_ALEXA_REMOTE2 = tools.DEBUG_ALEXA_REMOTE2;

function accountHttpResponse(RED, property, label, req, res) {
	const account = RED.nodes.getNode(req.query.account);
	console.log(req.url);

	if(!account) {
		res.writeHeader(400, {'Content-Type': 'text/plain'});
		return res.end(`Could not load ${label}: Account not deployed!`);
	}

	if(account.state.code !== 'READY') {
		res.writeHeader(400, {'Content-Type': 'text/plain'});
		return res.end(`Could not load ${label}: Account not initialised!`);
	}

	if(!account.hasOwnProperty(property)) {
		res.writeHeader(500, {'Content-Type': 'text/plain'});
		return res.end(`Could not load ${label}: Account not correctly initialised!`);
	}

	res.writeHeader(200, {'Content-Type': 'application/json'});
	res.end(typeof account[property] === 'string' ? account[property] : JSON.stringify(account[property]));
}

function getSmarthomeEntityLabel(entity) {
	function getIcon(applianceType) {
		switch(applianceType) {
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

	if(entity.type === 'APPLIANCE') {
		return entity.applianceTypes.map(getIcon).map(c => `&#x${c};`).join('') + `  ${entity.name}`;
	}
	else {
		const icon = 'f247'; // object-group
		return `&#x${icon};  ${entity.name}`; 
	}
}

function getDeviceLabel(device) {
	function getIcon(device) {
		switch(device.deviceFamily) {
			case 'TABLET': 							return 'f10a'; // tablet
			case 'VOX': 							return 'f007'; // user
			case 'THIRD_PARTY_AVS_MEDIA_DISPLAY': 	return 'f135'; // app
			case 'ECHO': 							return 'f270'; // amazon
			case 'FIRE_TV': 						return 'f06d'; // fire
			case 'WHA':								return 'f247'; // object-group
			case 'AMAZONMOBILEMUSIC_ANDROID':		return 'f17b'; // android
			default:								return 'f059'; // question-circle
		}
	}

	return `&#x${getIcon(device)};  ${device.accountName}`;
}

function getRoutineLabel(routine, smarthomeSimplifiedByEntityIdExt) {
	routine = tools.isObject(routine) && routine || {};
	const id = String(routine.automationId);
	const trigger = Array.isArray(routine.triggers) && routine.triggers[0] || {}; 
	const type = trigger.type || '';
	const disabled = routine.status === 'DISABLED';
	const suffix = disabled ? ' (disabled)' : '';

	// const shortId = 
	// 	  id.startsWith('amzn1.alexa.automation') 				? id.slice(id.lastIndexOf('-') + 1) 
	// 	: id.startsWith('amzn1.alexa.behaviors.preconfigured') 	? tools.keyToLabel(id.slice(id.lastIndexOf(':') + 1, tools.nthIndexOf(id, '_', 1)))
	// 	: '???';

	if(type.startsWith('Alexa.Trigger.Alarms')) {
		let action = type.slice(type.lastIndexOf('.') + 1);
		if(action === 'NotificationStopped') action = 'dismissed';
		return `&#xf0f3;  Alarm ${tools.keyToLabel(action)}${suffix}`; //bell
	}

	if(type.startsWith('Alexa.Trigger.Gadget.EchoButton')) {
		let action = type.slice(type.lastIndexOf('.') + 1);
		let shortId = trigger.payload.gadgetDsn.slice(-3);
		if(action === 'ButtonPress') action = 'pressed';
		return `&#xf111;  Button ${shortId} ${tools.keyToLabel(action)}${suffix}` // circle
	}

	if(type === 'CustomUtterance') {
		const utterance = trigger.payload.utterance;
		return `&#xf130;  "${utterance}"`; // microphone
	}

	if(type === 'motionSensorDetectionStateTrigger') {
		const entityId = trigger.payload.target;
		const entity = smarthomeSimplifiedByEntityIdExt.get(entityId);
		const name = entity && entity.name || '???';
		return `&#xf047;  Motion in ${name}${suffix}`; // arrows
	}

	if(type === 'AbsoluteTimeSchedule') {
		const time = trigger.schedule.triggerTime || '??????';
		const formatted = `${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}`;
		return `&#xf017;  Schedule ${formatted}${suffix}` // clock-o
	}

	return `&#xf059;  ${id}${suffix}` // question-circle
}

module.exports = function (RED) {
	function AlexaRemoteAccountNode(input) {
		RED.nodes.createNode(this, input);

		tools.log({self:this, status:this.status});

		tools.assign(this, ['authMethod', 'proxyOwnIp', 'proxyPort', 'cookieFile', 'alexaServiceHost', 'amazonPage', 'acceptLanguage', 'userAgent'], input);
		this.useWsMqtt = input.useWsMqtt === 'on';
		this.autoInit  = input.autoInit  === 'on';
		this.locale = this.acceptLanguage;

		this.alexa = new AlexaRemote();
		this.emitter = new EventEmitter().setMaxListeners(64);
		this.initing = false;
		this.state = { code: 'UNINITIALISED', message: '' }

		this.smarthomeForUiJson = null;
		this.devicesForUiJson = null;

		this.setState = function(code, message) {
			this.state = {
				code: code,
				message: message || code
			}
			this.emitter.emit('state', code, message);
		}
		this.resetAlexa = function () {
			if (!this.alexa) return;
			this.alexa.resetExt();
			this.initialised = false;
			this.alexa = new AlexaRemote();
			this.setState('UNINITIALISED');
		}

		this.buildSmarthomeForUi = function() {
			const smarthomeForUi = {};
			smarthomeForUi.entityById = Array.from(this.alexa.smarthomeSimplifiedByEntityIdExt.values())
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
				.reduce((obj, entity) => (obj[entity.entityId] = 
					[getSmarthomeEntityLabel(entity), entity.properties, entity.actions, entity.type]
				, obj), {});

			smarthomeForUi.colorNames = Array.from(this.alexa.colorNameToLabelExt.entries());
			smarthomeForUi.colorTemperatureNames = Array.from(this.alexa.colorTemperatureNameToLabelExt.entries());

			tools.log({smarthomeForUi: smarthomeForUi}, 10, 250);
			this.smarthomeForUiJson = JSON.stringify(smarthomeForUi);
		}
		this.buildDevicesForUi = function() {
			const deviceBySerial = this.alexa.serialNumbers;
			const result = Object.entries(deviceBySerial).map(([id, dev]) => [id, getDeviceLabel(dev)]);
			this.devicesForUiJson = JSON.stringify(result);
		}
		this.buildRoutinesForUi = async function() {
			const routineById = this.alexa.routineByIdExt;

			const routines = Array.from(routineById.entries())
				.sort(([_,a],[__,b]) => (a.status === 'DISABLED' ? 1 : -1) - (b.status === 'DISABLED' ? 1 : -1))
				.map(([id, routine]) => [id, getRoutineLabel(routine, this.alexa.smarthomeSimplifiedByEntityIdExt)]);

			const musicProviders = this.alexa.musicProvidersExt
				.filter(obj => obj.supportedOperations.includes('Alexa.Music.PlaySearchPhrase'))
				.map(obj => [obj.id, obj.displayName]);

			this.routinesForUiJson = JSON.stringify({
				routines: routines,
				musicProviders: musicProviders
			});
		}
		this.initAlexa = async function(input) {
			// we can hopefully do without this now by checking if this.alexa changes
			// if(this.initing) throw new Error('Already initialising!');
			// this.initing = true;

			const warnCb = tools.nodeGetWarnCb(this);
			const errCb = tools.nodeGetErrorCb(this);

			let config = {};
			tools.assign(config, ['proxyOwnIp', 'proxyPort', 'alexaServiceHost', 'amazonPage', 'acceptLanguage', 'userAgent', 'useWsMqtt'], this);	
			config.logger = DEBUG_ALEXA_REMOTE2 ? console.log : undefined;
			config.refreshCookieInterval = 0;
			config.proxyLogLevel = 'warn';
			config.cookieJustCreated = true; // otherwise it just tries forever...
			config.bluetooth = false;

			switch (this.authMethod) {
				case 'proxy':
					config.proxyOnly = true; // should not matter					

					const cookieData = tools.isObject(input) && input.loginCookie && tools.clone(input)
						 || this.cookieFile && await readFileAsync(this.cookieFile, 'utf8').then(json => JSON.parse(json)).catch(warnCb)
						 || undefined;

					config.cookie = cookieData;
					break;
				case 'cookie':
					tools.assign(config, ['cookie'], this.credentials);
					break;
				case 'password':
					tools.assign(config, ['email', 'password'], this.credentials);
					break;
			}

			if (!config.amazonPageProxyLanguage) config.amazonPageProxyLanguage = config.acceptLanguage && config.acceptLanguage.replace('-', '_') || undefined;

			// guess authentication method that AlexaRemote will use
			// useful if we want to drive init by input
			// currently initType should not differ this.authMethod
			const initType = config.cookie ? (config.cookie.loginCookie ? 'proxy' : 'cookie') : (config.email && config.password ? 'password' : 'proxy');

			this.resetAlexa();
			
			switch(initType) {
				case 'proxy': this.setState('INIT_PROXY'); break;
				case 'cookie': this.setState('INIT_COOKIE'); break;
				case 'password': this.setState('INIT_PASSWORD'); break;
			}

			// the this.alexa we init could change once the this.alexa.initExt is complete because
			// this.resetAlexa() or this.initAlexa() might have been called again during this time
			// so we need to check if this.alexa has changed and if so handle it differently
			const alexa = this.alexa;

			const proxyWaitCallback = (url) => {
				if(alexa !== this.alexa) return;
				const text = `open ${url} in your browser`;
				this.warn(text);
				this.setState('WAIT_PROXY', text);
			}

			const warnCallback = (error) => {
				if(alexa !== this.alexa) return;
				this.warn(error.message);
			}

			const cookieData = await alexa.initExt(config, proxyWaitCallback, warnCallback).catch(error => {
				if(alexa !== this.alexa) return;
				this.setState('ERROR', error && error.message);
				throw error;
			});

			// see above why
			if(alexa !== this.alexa) {
				throw new Error('Initialisation was aborted!');
			}

			if(this.authMethod === 'proxy' && this.cookieFile) {
				const data = this.alexa.cookieData;
				const json = JSON.stringify(data);
				try { fs.writeFileSync(this.cookieFile, json, 'utf8') }
				catch (error) { warnCb(error) }
			}

			this.buildDevicesForUi();
			this.buildSmarthomeForUi();
			await this.buildRoutinesForUi();

			// see above why
			if(alexa !== this.alexa) {
				throw new Error('Initialisation was aborted!');
			}

			this.setState('READY');
			return cookieData;
		}
		this.refreshAlexa = async function() {
			if(this.state.code !== 'READY') throw new Error('Not ready, must be initialised!');
			this.setState('REFRESH');
			return this.alexa.refreshExt().then();
		}

		this.on('close', function () {
			this.resetAlexa();
		});
		
		if(this.autoInit) {
			const errorCb = tools.nodeGetErrorCb(this);
			this.initAlexa(undefined).catch(errorCb);
		}
	}

	RED.nodes.registerType("alexa-remote-account", AlexaRemoteAccountNode, {
		credentials: {
			cookie: { type: 'text' },
			email: { type: 'text' },
			password: { type: 'password' },
		}
	});

	RED.httpAdmin.get('/alexa-remote-routines.json', (req, res) => accountHttpResponse(RED, 'routinesForUiJson', 'Routines', req, res));
	RED.httpAdmin.get('/alexa-remote-devices.json', (req, res) => accountHttpResponse(RED, 'devicesForUiJson', 'Devices', req, res));
	RED.httpAdmin.get('/alexa-remote-smarthome.json', (req, res) => accountHttpResponse(RED, 'smarthomeForUiJson', 'Smarthome Devices', req, res));
}