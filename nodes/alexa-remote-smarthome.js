const tools = require('../lib/tools.js');
const util = require('util');

module.exports = function (RED) {

	function AlexaRemoteSmarthome(input) {
		RED.nodes.createNode(this, input);
	
		tools.assignNode(RED, this, ['account'], input);
		tools.assign(this, ['config', 'outputs'], input);
		if(!tools.nodeSetupForStatusReporting(this)) return;
		//console.log({input:input});

		this.on('input', function (msg) {
			if(!this.account.initialised) {
				return tools.nodeErrVal(this, msg, new Error('Account not initialised'));
			}

			const {option, value} = this.config;
			//console.log({id: id, value:value});

			this.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			const account = this.account;
			const alexa = account.alexa;
			const callback = (err, val) => tools.nodeErrVal(this, msg, err, val);
			const callbackCached = (val) => val ? callback(null, val) : callback(new Error('Cached not available.'));

			switch(option) {
				case 'get': {
					switch(value.what) {
						case 'devices': 	return alexa.getSmarthomeDevices(callback);
						case 'groups': 		return alexa.getSmarthomeGroups(callback);
						case 'entities': 	return alexa.getSmarthomeEntities(callback);
						case 'definitions': return alexa.getSmarthomeBehaviourActionDefinitions(callback);
						case 'simplified': 	return callbackCached(account.smarthomeSimplified);
						default: 			return callback(new Error('Invalid "What"!'));
					}
				}
				case 'query': {
					if(!tools.matches(value, { list: [{	entity: '',	property: '' }] })) {
						return callback(new Error('Invalid Input! Notify the developer!'), this.config);
					}

					const queries = tools.clone(value.list);
					for(const query of queries) {
						const id = query.entity;
						delete query.entity;

						const entity = account.findSmarthomeEntity(id);
						if(!entity) return callback(new Error(`Device or group "${id}" not found!`));

						query.entityType = entity.type;
						query.entityName = entity.name;

						if(entity.type === 'GROUP') {
							query.entityId = entity.entityId;

							query.children = [];
							for(const entityId of entity.entityIds) {
								const entity = account.smarthomeSimplified && account.smarthomeSimplified[entityId];
								if(!entity) continue;
								
								const child = {};
								child.entityId = entity.applianceId;
								child.property = query.property;
								child.entityType = entity.type;
								child.entityName = entity.name;						

								query.children.push(child);
							}						
						}
						else {
							query.entityId = entity.applianceId; // yes this is correct
						}
					}
					
					const requests = queries.map(query => ({
						entityType: query.entityType,
						entityId: query.entityId
					}));
	
					return tools.querySmarthomeDevices(alexa, requests, (err, res) => {
						if(err) {
							return callback(err, res);
						}

						if(!tools.matches(res, {deviceStates: [], errors: []})) {
							const err = new Error('Unexpected response layout! Notify the developer!');
							return callback(err, res);
						}

						// map response to
						// { [id]: { [prop1]: value1 } }
						const states = {};
						for(const state of res.deviceStates) {
							const properties = {};

							properties.id = state.entity && state.entity.entityId;
							properties.type = state.entity && state.entity.entityType;
							if(state.error) properties.error = state.error;

							const capabilities = (state.capabilityStates || []).map(tools.tryParseJson).filter(tools.isObject);
							console.log(util.inspect({state:state}, false, 10, true));

							for(const capability of capabilities) {
								if(!tools.matches(capability, { name: '', value: undefined })) {
									const err = new Error('Unexpected capability layout! Notify the developer!');
									err.warning = true;
									callback(err, res);
									continue;
								}

								properties[capability.name] = capability.value;
							}

							states[properties.id] = properties;
						};

						const errors = {};
						for(const state of res.errors) {
							const properties = {};

							properties.id = state.entity && state.entity.entityId;
							properties.type = state.entity && state.entity.entityType;
							properties.code = state.code;
							properties.message = state.message;
							properties.data = state.data;

							errors[properties.id] = properties;
						};

						console.log(util.inspect({
							states: states,
							errors: errors,
						}, false, 10, true));

						const mapApplianceQuery = (query, reportErrors = true) => {
							const state = states[query.entityId];
							if(!state) { 
								if(!reportErrors) return null;
								
								let error = errors[query.entityId];
								if(!error) error = {message: `No response for device ${query.entityId}!`}
								this.error(error.message, error);
								return null;
							}

							if(query.property) {
								const mapped = {};
								mapped.id = state.id;
								mapped.type = state.type;
								if(state.error) mapped.error = state.error;
								//mapped.name = query.entityName;
								mapped.topic = query.entityName;
								mapped.payload = state[query.property];
								return mapped;
							}
							else {
								const mapped = Object.assign({}, state);
								//mapped.name = query.entityName;
								mapped.topic = query.entityName;
								return mapped;
							}
						};
						let msgs = queries.map(query => {
							if(query.entityType === 'APPLIANCE') {
								return mapApplianceQuery(query);
							}
							else if(query.entityType === 'GROUP') {
								return {
									id: query.entityId,
									type: 'GROUP',
									//name: query.entityName,
									topic: query.entityName,
									payload: query.children.map(q => mapApplianceQuery(q, false)).filter(r => r)
								};
							}
						});

						// if there are too many results put them in the last output payload
						if(msgs.length > this.outputs) {
							const result = msgs.slice(0, this.outputs);
							const last = msgs.slice(this.outputs-1);
							result[this.outputs-1] = {payload: last};
							msgs = result;
						}
 
						this.status({ shape: 'dot', fill: 'green', text: 'success' });
						this.send(msgs)
					});
				}
				case 'action': {
					if(!tools.matches(value, { list: [{	entity: '',	action: '' }] })) {
						return callback(new Error('Invalid Input! Notify the developer!'), this.config);
					}

					const requests = tools.clone(value.list);
					for(const request of requests) {
						const id = request.entity;
						delete request.entity;

						const entity = account.findSmarthomeEntity(id);
						if(!entity) return callback(new Error(`Device or group "${id}" not found!`));

						request.entityId = entity.entityId;
						request.entityType = entity.type;
						request.entityName = entity.name;

						if(!request.parameters) request.parameters = {};

						for(const [key, parameter] of Object.entries(request.parameters)) {
							if(tools.isObject(parameter) && parameter.type && parameter.value) {
								request.parameters[key] = RED.util.evaluateNodeProperty(parameter.value, parameter.type, this, msg);
							}
						}
					}
					console.log({requests: requests});

					const nativeRequests = requests.map(request => {
						const native = {};
						native.entityId = request.entityId;
						native.entityType = request.entityType;
						native.parameters = { action: request.action };
						
						switch(request.action) {
							case 'setColor': {
								native.parameters['colorName'] = account.findColorName(request.parameters.value);
								break;
							}
							case 'setColorTemperature': {
								native.parameters['colorTemperatureName'] = account.findColorTemperatureName(request.parameters.value);
								break;
							}
							case 'setBrightness': {
								native.parameters['brightness'] = Number(request.parameters.value);
								break;
							}
							case 'setPercentage': {
								native.parameters['percentage'] = Number(request.parameters.value);
								break;
							}
							case 'setLockState': 
							case 'lockAction': {
								native.parameters['targetLockState.value'] = String(request.parameters.value).trim().toUpperCase();
								break;
							}
							case 'setTargetTemperature': {
								native.parameters['targetTemperature.value'] = Number(request.parameters.value);
								native.parameters['targetTemperature.scale'] = String(request.parameters.scale).trim().toUpperCase();
								break;
							}
						}

						return native;
					});
					tools.log({nativeRequests: nativeRequests});

					return tools.executeSmarthomeDeviceAction(alexa, nativeRequests, (err, res) => {
						if(err) {
							return callback(err, res);
						}

						if(!tools.matches(res, {controlResponses: [], errors: []})) {
							const err = new Error('Unexpected response layout! Notify the developer!');
							return callback(err, res);
						}

						tools.log({response:res});

						const responses = {};
						for(const response of res.controlResponses) {
							response.id = response.entityId;
							delete response.entityId;
							responses[response.id] = response;
						}

						const errors = {};
						for(const error of res.errors) {
							error.id = error.entity && error.entity.entityId;
							error.type = error.entity && error.entity.entityType;
							delete error.entity;
							errors[error.id] = error;
						}

						tools.log({responses:responses, errors: errors});

						let msgs = requests.map(request => {
							const response = responses[request.entityId];
							if(!response) {
								let error = errors[request.entityId];
								if(!error) error = {message: `No response for entity "${request.entityName}" (${request.entityId})!`}
								this.error(error.message, error);
								return null;
							}

							return response;
						});

						let successCount = msgs.filter(m => m).length;
						tools.log({msgs:msgs, count: successCount});

						// if there are too many msgs put them in the last output payload
						if(msgs.length > this.outputs) {
							const result = msgs.slice(0, this.outputs);
							const last = msgs.slice(this.outputs-1).filter(x => x);
							result[this.outputs-1] = {payload: last};
							msgs = result;
						}

						this.status({
							shape: 'dot',
							fill: successCount === requests.length ? 'green' : successCount !== 0 ? 'yellow' : 'red',
							text: `${successCount}/${requests.length} successful`
						});
						
						this.send(msgs);
					});
				}
				case 'discover': {
					return alexa.discoverSmarthomeDevice(callback);
				}
				case 'delete': {
					const what = value.what.name;
					const id = RED.util.evaluateNodeProperty(value.what.value.name.value, value.what.value.name.type, this, msg);
					
					switch(what) {
						case 'device': 		return alexa.deleteSmarthomeDevice(id, callback);
						case 'allDevices': 	return alexa.deleteAllSmarthomeDevices(callback);
						case 'group': 		return alexa.deleteSmarthomeGroup(id, callback);
						default: 			return callback(new Error('Invalid "What"!'));
					}
				}
			}
		});
	}
	RED.nodes.registerType("alexa-remote-smarthome", AlexaRemoteSmarthome)
}