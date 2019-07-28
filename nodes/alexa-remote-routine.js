const tools = require('../lib/common.js');

module.exports = function (RED) {
	function AlexaRemoteRoutine(input) {
		RED.nodes.createNode(this, input);
		tools.assign(this, ['routineNode'], input);
		tools.assignNode(RED, this, ['account'], input);
		if (!tools.nodeSetup(this, input, true)) return;
		// tools.log({in:input.routineNode, ths: this.routineNode});

		this.on('input', function (msg) {
			const send = tools.nodeGetSendCb(this, msg);
			const error = tools.nodeGetErrorCb(this);
			if (this.account.state.code !== 'READY') return error('Account not initialised!');
			this.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			const alexa = this.account.alexa;
			const evaluated = tools.nodeEvaluateProperties(RED, this, msg, this.routineNode);
			tools.log({ raw: this.routineNode, eval: evaluated });
			const customerId = alexa.ownerCustomerId;
			const locale = this.account.locale || 'en-US';

			const deviceToVolume = new Map();

			function nativizePromptType(prompt) {
				switch (prompt) {
					case 'goodMorning': return 'Alexa.GoodMorning.Play';
					case 'weather': return 'Alexa.Weather.Play';
					case 'traffic': return 'Alexa.Traffic.Play';
					case 'flashBriefing': return 'Alexa.FlashBriefing.Play';
					case 'singSong': return 'Alexa.SingASong.Play';
					case 'joke': return 'Alexa.Joke.Play';
					case 'tellStory': return 'Alexa.TellStory.Play';
					case 'calendarToday': return 'Alexa.Calendar.PlayToday';
					case 'calendarTomorrow': return 'Alexa.Calendar.PlayTomorrow';
					case 'calendarNext': return 'Alexa.Calendar.PlayNext';
					default: throw new Error(`invalid prompt: "${prompt}"`);
				}
			}
			const find = (id) => {
				const device = alexa.find(id);
				if (!device) throw new Error(`could not find device: "${id}"`);
				return device;
			}

			const findAll = (ids, depth = 1) => {
				let devices = [];
				for (const id of ids) {
					if (id === 'ALEXA_ALL_DSN') return [{ serialNumber: 'ALEXA_ALL_DSN', deviceType: 'ALEXA_ALL_DEVICE_TYPE', clusterMembers: [] }];
					const device = find(id)

					if (device.clusterMembers.length !== 0 && depth !== 0) {
						// we are dealing with a group so we seperate it into members because
						// groups don't work	
						const members = findAll(device.clusterMembers, depth - 1);
						devices = devices.concat(members);
					}
					else {
						devices.push(device);
					}
				}
				return devices;
			}

			async function nativizeNode(node) {
				const invalid = () => new Error(`invalid sequence node: "${JSON.stringify(node)}"`);
				if (!tools.matches(node, { type: '', payload: {} })) throw invalid();

				switch (node.type) {
					case 'speak': {
						if (!Array.isArray(node.payload.devices)) node.payload.devices = [node.payload.devices || node.payload.device];
						if (!tools.matches(node.payload, { type: '', text: '', devices: [] })) throw invalid();
						const devices = findAll(node.payload.devices);
						if (devices.length === 0) return undefined;

						switch (node.payload.type) {
							case 'regular':
								if (devices.length === 1) return {
									'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
									type: 'Alexa.Speak',
									operationPayload: {
										deviceType: devices[0].deviceType,
										deviceSerialNumber: devices[0].serialNumber,
										locale: locale,
										customerId: customerId,
										textToSpeak: node.payload.text
									}
								}

								return await nativizeNode({
									type: 'node',
									payload: {
										type: 'parallel',
										children: devices.map(device => ({
											type: 'speak',
											payload: {
												type: 'regular',
												text: node.payload.text,
												device: device,
											}
										}))
									}
								});
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
											title: 'Node-RED',
											body: node.payload.text.replace(/<[^>]+>/g, '')
										},
										speak: {
											type: node.payload.type === 'ssml' ? 'ssml' : 'text',
											value: node.payload.text
										}
									}],
									target: {
										customerId: customerId,
										devices: findAll(node.payload.devices).map(device => ({
											deviceSerialNumber: device.serialNumber,
											deviceTypeId: device.deviceType,
										}))
									}
								}
							}
							default: throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);
						}
					}
					case 'speakAtVolume': {
						if (!Array.isArray(node.payload.devices)) node.payload.devices = [node.payload.devices || node.payload.device];
						if (!tools.matches(node.payload, { type: '', text: '', volume: undefined, devices: [] })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);
						const devices = findAll(node.payload.devices);
						if(devices.length === 0) return undefined;

						for (const device of devices) {
							if (deviceToVolume.has(device)) continue;
							const media = await alexa.getMediaPromise(device);
							if (!tools.matches(media, { volume: 50 })) throw new Error(`unexpected response while getting volume: "${JSON.stringify(media)}"`);
							deviceToVolume.set(device, media.volume);
						}

						return await nativizeNode({
							type: 'node',
							payload: {
								type: 'serial',
								children: [
									{
										type: 'volume',
										payload: {
											value: node.payload.volume,
											devices: devices,
										}
									},
									{
										type: 'speak',
										payload: {
											type: node.payload.type,
											text: node.payload.text,
											devices: devices,
										}
									},
									{
										type: 'node',
										payload: {
											type: 'parallel',
											children: devices.map(device => ({
												type: 'volume',
												payload: {
													value: deviceToVolume.get(device),
													device: device,
												}
											}))
										}
									}
								]
							}
						})
					}
					case 'stop': {
						if (!Array.isArray(node.payload.devices)) node.payload.devices = [node.payload.devices || node.payload.device];
						if (!tools.matches(node.payload, { devices: [] })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);
						const devices = findAll(node.payload.devices);
						if(devices.length === 0) return undefined;

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.DeviceControls.Stop',
							skillId: 'amzn1.ask.1p.alexadevicecontrols',
							operationPayload: {
								customerId: customerId,
								devices: devices.map(device => ({
									deviceSerialNumber: device.serialNumber,
									deviceType: device.deviceType,
								})),
								isAssociatedDevice: false
							},
							name: null
						}
					}
					case 'prompt': {
						if (!Array.isArray(node.payload.devices)) node.payload.devices = [node.payload.devices || node.payload.device];
						if (!tools.matches(node.payload, { type: '', devices: [] })) throw invalid();
						const devices = findAll(node.payload.devices);
						if(devices.length === 0) return undefined;

						if (devices.length === 1) return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: nativizePromptType(node.payload.type),
							operationPayload: {
								deviceType: devices[0].deviceType,
								deviceSerialNumber: devices[0].serialNumber,
								locale: locale,
								customerId: customerId
							}
						}

						return await nativizeNode({
							type: 'node',
							payload: {
								type: 'parallel',
								children: devices.map(device => ({
									type: 'prompt',
									payload: {
										type: node.payload.type,
										device: device,
									}
								}))
							}
						});
					}
					case 'volume': {
						if (!Array.isArray(node.payload.devices)) node.payload.devices = [node.payload.devices || node.payload.device];
						if (!tools.matches(node.payload, { value: undefined, devices: [] })) throw invalid();
						const volume = Number(node.payload.value);
						if (Number.isNaN(volume)) throw invalid();
						const devices = findAll(node.payload.devices);
						if (devices.length === 0) return undefined;

						if (devices.length === 1) return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.DeviceControls.Volume',
							operationPayload: {
								deviceType: devices[0].deviceType,
								deviceSerialNumber: devices[0].serialNumber,
								locale: locale,
								customerId: customerId,
								value: volume,
							}
						}

						return await nativizeNode({
							type: 'node',
							payload: {
								type: 'parallel',
								children: devices.map(device => ({
									type: 'volume',
									payload: {
										value: volume,
										device: device,
									}
								}))
							}
						});
					}
					case 'music': {
						if (!tools.matches(node.payload, { device: undefined, provider: '', search: '', duration: 300 })) throw invalid();
						const device = find(node.payload.device);

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

						if (node.payload.duration) {
							native.operationPayload.waitTimeInSeconds = node.payload.duration;
						}

						return native;
					}
					case 'wait': {
						const time = Number(node.payload.time);
						if (Number.isNaN(time)) throw invalid();

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
						if (!tools.matches(node.payload, { entity: '', action: '' })) throw new Error(`invalid sequence node: "${JSON.stringify(node)}"`);

						const entity = alexa.findSmarthomeEntityExt(node.payload.entity);
						if (!entity) throw new Error(`could not find smarthome entity: "${node.payload.device}"`);

						const parameters = { type: node.payload.action };
						switch (node.payload.action) {
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
									value: String(node.payload.value).trim().toUpperCase()
								}
								break;
							}
							case 'setTargetTemperature': {
								parameters.targetTemperature = {
									scale: String(node.payload.scale).trim().toUpperCase() || 'CELSIUS',
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
						if (!tools.matches(node.payload, { routine: '', device: undefined })) throw invalid();

						const device = find(node.payload.device);
						const routine = alexa.findRoutineExt(node.payload.routine);
						if (!routine) throw new Error(`could not find routine: "${node.payload.routine}"`);

						const routineNode = tools.clone(routine.sequence.startNode);
						tools.mapObject(routineNode, (key, val) => {
							if (key === 'deviceType' && val === 'ALEXA_CURRENT_DEVICE_TYPE') return device.deviceType;
							if (key === 'deviceTypeId' && val === 'ALEXA_CURRENT_DEVICE_TYPE') return device.deviceType;
							if (key === 'deviceSerialNumber' && val === 'ALEXA_CURRENT_DSN') return device.serialNumber;
							if (key === 'locale' && val === 'ALEXA_CURRENT_LOCALE') return locale;
							return val;
						});

						return routineNode;
					}
					case 'pushNotification': {
						if (!tools.matches(node.payload, { text: '' })) throw invalid();

						return {
							'@type': 'com.amazon.alexa.behaviors.model.OpaquePayloadOperationNode',
							type: 'Alexa.Notifications.SendMobilePush',
							skillId: 'amzn1.ask.1p.alexanotifications',
							operationPayload: {
								customerId: customerId,
								notificationMessage: node.payload.text,
								alexaUrl: '#v2/behaviors',
								title: 'Node-RED'
							},
							name: null
						}
					}
					case 'node': {
						if (!tools.matches(node.payload, { type: '', children: [] })) throw invalid();

						const suffix =
							node.payload.type === 'serial' ? 'SerialNode' :
							node.payload.type === 'parallel' ? 'ParallelNode' :
							undefined;

						if (!suffix) throw invalid();

						const nativeChildren = [];
						for (const child of node.payload.children) {
							const native = await nativizeNode(child)
							nativeChildren.push(native);
						}

						return {
							'@type': `com.amazon.alexa.behaviors.model.${suffix}`,
							nodesToExecute: nativeChildren,
							name: null,
						}
					}
					case 'custom': {
						if (!tools.matches(node.payload, {})) throw invalid();
						return await nativizeNode(node.payload);
					}
					default: throw invalid();
				}
			}

			nativizeNode(evaluated).then(native => {
				tools.log({ evaluated: evaluated, native: native });
				alexa.sendSequenceNodeExt(native).then(send).catch(error);
			}).catch(error);
		});
	}
	RED.nodes.registerType("alexa-remote-routine", AlexaRemoteRoutine)
}