const EventEmitter = require('events');
const tools = require('../tools/tools.js');
const AlexaRemote = tools.AlexaRemote;
const fs = require('fs');
const DEBUG = true;

module.exports = function (RED) {
	function AlexaRemoteAccountNode(input) {
		RED.nodes.createNode(this, input);

		tools.assign(this, ['authMethod', 'proxyPort', 'cookieFile', 'alexaServiceHost', 'userAgent', 'amazonPage'], input);
		this.useWsMqtt = input.useWsMqtt === 'on';
		this.bluetooth = input.bluetooth === 'on';

		this.alexa = new AlexaRemote();
		this.emitter = new EventEmitter();
		this.initing = false;
		this.status = { code: 'uninitialized', message: 'uninitialized' }
		this.initialised = false;

		this._status = function(code, message) {
			this.status = {
				code: code,
				message: message || code
			}
			this.emitter.emit('status', code, message);
			console.log(`STATUS: ${code} (${message})`)
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
			
			this._status('stopped')
			this.alexa = new AlexaRemote();

			this.initing = false;
		}
		this._initAlexaFromObject = function (input, callback) {
			console.log({fun:'fromObject', callback:callback});
			// start from blank slate
			this._stopAlexa();

			const config = {}
			tools.assign(config, ['proxyPort', 'alexaServiceHost', 'userAgent', 'amazonPage', 'useWsMqtt', 'bluetooth'], this);

			config.logger = DEBUG ? console.log : undefined;
			config.refreshCookieInterval = 0;
			config.proxyOwnIp = 'localhost';
			config.proxyLogLevel = 'warn';
			config.amazonPageProxyLanguage = config.acceptLanguage ? config.acceptLanguage.replace('-', '_') : undefined;

			switch (this.authMethod) {
				case 'proxy':
					config.proxyOnly = true; // optional
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

			if(!config.cookie && config.formerRegistrationData) {
				config.cookie = config.formerRegistrationData.localCookie;
			}

			if(config.cookie) {
				if(config.formerRegistrationData){
					this._status('init-proxy');
				}
				else {
					this._status('init-cookie');
				}
			} 
			else if (config.email && config.password) {
				this._status('init-password');
			}
			else {
				this._status('init-proxy');
			}

			console.log({config: config, input: input});

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
					console.log(`CALLBACK: _initAlexaFromObject`, err);
					this.initialised = true;
					this._status('ready');
					callback && callback(err, val);
				}

				

				// if (err) {
				// 	callback && callback(err, val);
				// 	return;
				// }

				// // alexa-remote returns no err on authentication fail, so check again
				// this.alexa.checkAuthentication((authenticated) => {
				// 	if (!authenticated) {
				// 		err = new Error('Authentication failed');
				// 	}
				// 	callback && callback(err, val);
				// });
			});
		}
		this._initAlexaFromObjectOrFile = function (input, callback) {
			console.log({fun:'fromObjectOrFile', callback:callback});

			if(input.formerRegistrationData || this.authMethod !== 'proxy' || !this.cookieFile) {
				console.log(`FORWARD: _initAlexaFromObjectOrFile NOTHING`);
				return this._initAlexaFromObject(input, callback);
			}

			fs.readFile(this.cookieFile, 'utf8', (err, val) => {
				console.log(`CALLBACK: _initAlexaFromObjectOrFile`, err);
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
			console.log({fun:'fromObjectOrFileLocked', callback:callback});

			if (this.initing) {
				const error = new Error('Already initialising');
				error.warning = true;
				return callback && callback(error);
			}

			this.initing = true;
			this._initAlexaFromObjectOrFile(input, (err, val) => {
				console.log(`CALLBACK: _initAlexaFromObjectOrFileLocked`, err);
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

			this._status('refreshing');
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
		})
	}
	RED.nodes.registerType("alexa-remote-account", AlexaRemoteAccountNode, {
		credentials: {
			cookie: { type: 'text' },
			email: { type: 'text' },
			password: { type: 'password' },
		}
	});
}