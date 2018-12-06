const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteActionNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;

		tools.assignTyped(node, ['target', 'serialOrName'], input);
		tools.assign(node, ['options'], input);
		tools.assignNode(RED, node, ['account'], input);
		// console.log(node.target_value, node.options);

		node.on('close', function (removed, done) { this.status({}); done(); });
		node.on('input', function (msg) {
			let { target, serialOrName } = tools.assignTypedConvert(RED, node, msg, {}, ['target', 'serialOrName'], node);
			let options = tools.assignTypedStructConvert(RED, node, msg, {}, node.options[target]);

			// console.log(target, options);
			let sendFun = (alexa) => {
				return new Promise((resolve, reject) => {
					let callback = (err, val) => err ? reject(err) : resolve(val);

					switch (target) {
						case 'checkAuthentication': 		return alexa.checkAuthentication((val) => resolve(val));
						case 'createNotification': 			return alexa.createNotification(alexa.createNotificationObject(serialOrName, options.type, options.label, options.value, options.status, options.sound), callback);
						case 'deleteNotification': 			return alexa.deleteNotification({id: options.id}, callback);
						case 'tuneinSearch':				return alexa.tuneinSearch(options.query, callback);
						case 'findDevice': 					return resolve(alexa.find(serialOrName));
						case 'renameDevice':				return alexa.renameDevice(serialOrName, options.newName, callback);
						case 'deleteDevice':				return alexa.deleteDevice(serialOrName, callback);
						case 'executeAutomationRoutine': 	return alexa.executeAutomationRoutine(serialOrName, { sequenceId: true, automationId: options.automationId }, callback);
						case 'playMusicProvider': 			return alexa.playMusicProvider(serialOrName, options.providerId, options.searchPhrase, callback);
						case 'sendTextMessage': 			return alexa.sendTextMessage(options.conversationId, options.text, callback);
						case 'deleteSmarthomeDevice': 		return alexa.deleteSmarthomeDevice(options.smarthomeDevice, callback);
						case 'deleteSmarthomeGroup': 		return alexa.deleteSmarthomeGroup(options.smarthomeGroup, callback);
						case 'deleteAllSmarthomeDevices': 	return alexa.deleteAllSmarthomeDevices(callback);
						case 'discoverSmarthomeDevice': 	return alexa.discoverSmarthomeDevice(callback);
						case 'querySmarthomeDevices': 		return alexa.querySmarthomeDevices(options.applicanceIds, options.entityType, callback);
						case 'connectBluetooth': 			return alexa.connectBluetooth(serialOrName, options.address, callback);
						case 'unpaireBluetooth': 			return alexa.unpaireBluetooth(serialOrName, options.address, callback);
						case 'disconnectBluetooth': 		return alexa.disconnectBluetooth(serialOrName, options.address, callback);
						default: return Promise.reject(new Error('invalid action target'));
					}
				})
			}

			tools.initAndSend(node, msg, sendFun);
		});
	}
	RED.nodes.registerType("alexa-remote-action", AlexaRemoteActionNode)
}