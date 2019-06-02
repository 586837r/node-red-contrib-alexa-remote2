const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteActionNode(input) {
		RED.nodes.createNode(this, input);

		tools.assignTyped(this, ['target', 'serialOrName'], input);
		tools.assign(this, ['options'], input);
		tools.assignNode(RED, this, ['account'], input);
		tools.nodeSetupForStatusReporting(this);

		this.on('input', function (msg) {
			if(!this.account.initialised) {
				return tools.nodeErrVal(this, msg, new Error('Account not initialised'));
			}

			const { target, serialOrName } = tools.assignTypedConvert(RED, this, msg, {}, ['target', 'serialOrName'], this);
			const options = tools.assignTypedStructConvert(RED, this, msg, {}, this.options[target]);

			this.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			const alexa = this.account.alexa;
			const callback = (err, val) => tools.nodeErrVal(this, msg, err, val);

			switch (target) {
				case 'checkAuthentication': 		return alexa.checkAuthentication((val) => resolve(val));
				case 'createNotification': 			return alexa.createNotification(alexa.createNotificationObject(serialOrName, options.type, options.label, options.value, options.status, options.sound), callback);
				case 'deleteNotification': 			return alexa.deleteNotification({id: options.id}, callback);
				case 'tuneinSearch':				return alexa.tuneinSearch(options.query, callback);
				case 'findDevice': 					return tools.nodeErrVal(node, msg, undefined, alexa.find(serialOrName));
				case 'renameDevice':				return alexa.renameDevice(serialOrName, options.newName, callback);
				case 'deleteDevice':				return alexa.deleteDevice(serialOrName, callback);
				case 'executeAutomationRoutine': 	return tools.executeAutomationRoutine(alexa, serialOrName, options.utteranceOrId, callback);
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
				default: 							return callback(new Error('Invalid action target'));
			}
		});
	}
	RED.nodes.registerType("alexa-remote-action", AlexaRemoteActionNode)
}