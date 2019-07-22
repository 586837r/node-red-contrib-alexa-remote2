const tools = require('../lib/common.js');
const util = require('util');
const convert = require('../lib/color-convert.js');

module.exports = function (RED) {
	function AlexaRemoteRoutine(input) {
		RED.nodes.createNode(this, input);
		tools.assign(this, ['routineNode'], input);
		tools.assignNode(RED, this, ['account'], input);
		if(!tools.nodeSetup(this, input, true)) return;
		// tools.log({in:input.routineNode, ths: this.routineNode});

		this.on('input', function(msg) {
			const send = tools.nodeGetSendCb(this, msg);
			const error = tools.nodeGetErrorCb(this);
			if(this.account.state.code !== 'READY') return error('Account not initialised!');
			this.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			const alexa = this.account.alexa;
			const evaluated = tools.nodeEvaluateProperties(RED, this, msg, this.routineNode);
			tools.log({raw:this.routineNode, eval:evaluated});
			const customerId = alexa.ownerCustomerId;
			const locale = this.account.locale || 'en-US';

			function deviceIdsToDsnTypePairs(deviceIds, depth = 1) {
				let pairs = [];
				for(const id of deviceIds) {
					if(id === 'ALEXA_ALL_DSN') {
						pairs.push(['ALEXA_ALL_DSN', 'ALEXA_ALL_DEVICE_TYPE']);
						continue;
					}

					const device = alexa.find(id);

					if(!device) {
						throw new Error(`could not find device: "${id}"`);
					}

					if(device.clusterMembers.length !== 0 && depth !== 0) {
						// we are dealing with a group so we seperate it into members because
						// groups don't work	
						const childPairs = deviceIdsToDsnTypePairs(device.clusterMembers, depth - 1);
						pairs = pairs.concat(childPairs);
						continue;
					}
					
					pairs.push([device.serialNumber, device.deviceType]);
				}
				return pairs;
			}
			function nativizePromptType(prompt) {
				switch(prompt) {
					case 'goodMorning': 		return 'Alexa.GoodMorning.Play';
					case 'weather': 			return 'Alexa.Weather.Play';
					case 'traffic': 			return 'Alexa.Traffic.Play';
					case 'flashBriefing': 		return 'Alexa.FlashBriefing.Play';
					case 'singSong':			return 'Alexa.SingASong.Play';
					case 'joke':				return 'Alexa.Joke.Play';
					case 'tellStory':			return 'Alexa.TellStory.Play';
					case 'calendarToday':		return 'Alexa.Calendar.PlayToday';
					case 'calendarTomorrow': 	return 'Alexa.Calendar.PlayTomorrow';
					case 'calendarNext': 		return 'Alexa.Calendar.PlayNext';
					default: throw new Error(`invalid prompt: "${prompt}"`);
				}
			}
			function nativizeNode(node) {
				if(!tools.matches(node, {type: '', payload: {}})) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

				switch(node.type) {
					case 'speak': {
						if(!tools.matches(node.payload, { type: '', text: '', devices: [''] })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						switch(node.payload.type) {
							case 'regular': return {
								'@type': 'com.amazon.alexa.behaviors.model.ParallelNode',
								'name': null,
								'nodesToExecute': deviceIdsToDsnTypePairs(node.payload.devices).map(([dsn,type]) => ({
									'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
									type: 'Alexa.Speak',
									operationPayload: {
										deviceType: type,
										deviceSerialNumber: dsn,
										locale: locale,
										customerId: customerId,
										textToSpeak: node.payload.text
									}	
								}))
							}
							case 'ssml':
							case 'announcement': return {
								'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
								type: 'AlexaAnnouncement',
								operationPayload: {
									expireAfter: 'PT5S',
									customerId: customerId,
									content: [{
										locale: locale,
										display: {
											title: 'NodeRed',
											body: node.payload.text.replace(/<[^>]+>/g, '')
										},
										speak: {
											type: node.payload.type === 'ssml' ? 'ssml' : 'text',
											value: node.payload.text
										}
									}],
									target: {
										customerId: customerId,
										devices: deviceIdsToDsnTypePairs(node.payload.devices).map(([dsn,type]) => ({
											deviceSerialNumber: dsn,
											deviceTypeId: type
										}))
									}
								}
							}
							default: throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);
						}						
					}
					case 'speakRegularSingle': {
						if(!tools.matches(node.payload, { text: '', device: '' })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						const device = alexa.find(node.payload.device);
						if(!device) throw new Error(`could not find device: "${node.payload.device}"`);

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.Speak',
							operationPayload: {
								deviceType: device.deviceType,
								deviceSerialNumber: device.serialNumber,
								locale: locale,
								customerId: customerId,
								textToSpeak: node.payload.text
							}
						}
					}
					case 'stop': {
						if(!tools.matches(node.payload, { devices: [''] })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.DeviceControls.Stop',
							skillId: 'amzn1.ask.1p.alexadevicecontrols',
							operationPayload: {
								customerId: customerId,
								devices: deviceIdsToDsnTypePairs(node.payload.devices).map(([dsn, type]) => ({
									deviceSerialNumber: dsn,
									deviceType: type
								})),
								isAssociatedDevice: false
							},
							name: null
						}
					}
					case 'prompt': {
						if(!tools.matches(node.payload, { type: '', device: ''})) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						const device = alexa.find(node.payload.device);
						if(!device) throw new Error(`could not find device: "${node.payload.device}"`);

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: nativizePromptType(node.payload.type),
							operationPayload: {
								deviceType: device.deviceType,
								deviceSerialNumber: device.serialNumber,
								locale: 'ALEXA_CURRENT_LOCALE',
								customerId: customerId
							}
						}
					}
					case 'volume': {
						if(!tools.matches(node.payload, { value: 1, devices: ['']})) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						return {
							'@type': 'com.amazon.alexa.behaviors.model.ParallelNode',
							'name': null,
							'nodesToExecute': deviceIdsToDsnTypePairs(node.payload.devices).map(([dsn,type]) => ({
								'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
								type: 'Alexa.DeviceControls.Volume',
								operationPayload: {
									deviceType: type,
									deviceSerialNumber: dsn,
									locale: locale,
									customerId: customerId,
									value: node.payload.value
								}	
							}))
						}
					}
					case 'music': {
						if(!tools.matches(node.payload, { device: '', provider: '', search: '', duration: 300})) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						const device = alexa.find(node.payload.device);
						if(!device) throw new Error(`could not find device: "${node.payload.device}"`);

						const native = {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.Music.PlaySearchPhrase',
							operationPayload: {
								customerId: customerId,
								deviceType: device.deviceType,
								deviceSerialNumber: device.serialNumber,
								musicProviderId: node.payload.provider,
								searchPhrase: node.payload.search,
								sanitizedSearchPhrase: node.payload.search.trim().toLowerCase(),
								locale: locale,
							},
							skillId: null,
						}

						if(node.payload.duration) {
							native.operationPayload.waitTimeInSeconds = node.payload.duration;
						}

						return native;
					}
					case 'wait': {
						if(!tools.matches(node.payload, { time: 32 })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.System.Wait',
							skillId: null,
							operationPayload: {
								waitTimeInSeconds: node.payload.time
							},
							name: null,
						}
					}
					case 'smarthome': {
						if(!tools.matches(node.payload, { entity: '', action: '' })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						const entity = alexa.findSmarthomeEntityExt(node.payload.entity);
						if(!entity) throw new Error(`could not find smarthome entity: "${node.payload.device}"`);

						const parameters = { type: node.payload.action };
						switch(node.payload.action) {
							case 'setColor': {
								parameters.colorName = alexa.findSmarthomeColorNameExt(node.payload.value);
								break;
							}
							case 'setColorTemperature': {
								parameters.colorTemperatureName = alexa.findSmarthomeColorTemperatureNameExt(node.payload.value);
								break;
							}
							case 'setBrightness': {
								parameters.brightness = Number(node.payload.value);
								break;
							}
							case 'setPercentage': {
								parameters.percentage = Number(node.payload.value);
								break;
							}
							case 'setLockState': 
							case 'lockAction': {
								parameters.targetLockState = {
									value:  String(node.payload.value).trim().toUpperCase()
								}
								break;
							}
							case 'setTargetTemperature': {
								parameters.targetTemperature = {
									scale: String(node.payload.scale).trim().toUpperCase(),
									value: Number(node.payload.value)
								}
								break;
							}
						}

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.SmartHome.Batch',
							skillId: 'amzn1.ask.1p.smarthome',
							operationPayload: {
								target: entity.entityId,
								customerId: customerId,
								operations: [
									parameters
								],
								name: null,
							}
						}
					}
					case 'routine': {
						if(!tools.matches(node.payload, { routine: '', device: '' })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						const routine = alexa.routineByIdExt.get(node.payload.routine);
						if(!routine) throw new Error(`could not find routine: "${node.payload.routine}"`);

						const device = alexa.find(node.payload.device);
						if(!device) throw new Error(`could not find device: "${node.payload.device}"`)

						const routineNode = tools.clone(routine.sequence.startNode);
						tools.mapObject(routineNode, (key, val) => {
							if(key === 'deviceType' 		&& val === 'ALEXA_CURRENT_DEVICE_TYPE') return device.deviceType;
							if(key === 'deviceTypeId' 		&& val === 'ALEXA_CURRENT_DEVICE_TYPE') return device.deviceType;
							if(key === 'deviceSerialNumber' && val === 'ALEXA_CURRENT_DSN') 		return device.serialNumber;
							if(key === 'locale' 			&& val === 'ALEXA_CURRENT_LOCALE') 		return locale;
							return val;
						});
						
						return routineNode;
					}
					case 'pushNotification': {
						if(!tools.matches(node.payload, { text: '' })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.Notifications.SendMobilePush',
							skillId: 'amzn1.ask.1p.alexanotifications',
							operationPayload: {
								customerId: customerId,
								notificationMessage: node.payload.text,
								alexaUrl: '#v2/behaviors',
								title: 'NodeRed'
							},
							name: null
						}
					}
					case 'node': {
						if(!tools.matches(node.payload, { type: '', children: [] })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						const suffix = 
							node.payload.type === 'serial' ? 'SerialNode' :
							node.payload.type === 'parallel' ? 'ParallelNode' :
							undefined;

						if(!suffix) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`)

						return {
							 '@type': `com.amazon.alexa.behaviors.model.${suffix}`,
							 'nodesToExecute': node.payload.children.map(nativizeNode),
							 'name': null,
						}
					}
					default: throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);
				}
			}

			let nativeNode; try { nativeNode = nativizeNode(evaluated) } catch (e) { return error(e) }
			tools.log({evaluated:evaluated, native:nativeNode});

			alexa.sendSequenceNodeExt(nativeNode).then(send).catch(error);			
		});
	}
	RED.nodes.registerType("alexa-remote-routine", AlexaRemoteRoutine)
}