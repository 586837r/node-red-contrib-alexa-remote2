const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteGetNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;

		tools.assignTyped(node, ['target', 'serialOrName'], input);
		tools.assign(node, ['options'], input);
		tools.assignNode(RED, node, ['account'], input);
		// console.log(node.target_value, node.options);

		node.on('close', function(removed, done) { this.status({}); done(); });
		node.on('input', function (msg) {
			let { target, serialOrName } = tools.assignTypedConvert(RED, node, msg, {}, ['target', 'serialOrName'], node);
			let options = tools.assignTypedStructConvert(RED, node, msg, {}, node.options[target]); 

			// console.log(target, options);
			let sendFun = (alexa) => {
				return new Promise((resolve, reject) => {
					let callback = (err, val) => err ? reject(err) : resolve(val); 

					switch (target) {
						case 'devices': 								return alexa.getDevices(callback);
						case 'cards':									return alexa.getCards(options.limit, options.beforeCreationTime, callback);
						case 'media':									return alexa.getMedia(serialOrName, callback);
						case 'playerInfo':								return alexa.getPlayerInfo(serialOrName, callback);
						case 'list':									return alexa.getList(serialOrName, options.listType, options, callback);
						//(alexa-remote2 bug) case 'lists':				return alexa.getLists(options.serialOrName, options, callback);
						case 'wakewords':								return alexa.getWakeWords(callback);
						case 'notifications': /*case 'reminders':*/		return alexa.getNotifications(options.cached, callback);
						case 'doNotDisturb':							return alexa.getDoNotDisturb(callback);
						case 'deviceStatusList':						return alexa.getDeviceStatusList(callback);
						case 'deviceNotificationState':					return alexa.getDeviceNotificationState(serialOrName, callback);
						case 'bluetooth':								return alexa.getBluetooth(options.cached, callback);
						case 'activities':	/*case 'history':*/			return alexa.getActivities(options, callback);
						case 'account':									return alexa.getAccount(callback);
						case 'conversations':							return alexa.getConversations(options, callback);					
						case 'automationRoutines':						return alexa.getAutomationRoutines(options.limit, callback);
						case 'musicProviders':							return alexa.getMusicProviders(callback);
						case 'homeGroup':								return alexa.getHomeGroup(callback);
						case 'devicePreferences':						return alexa.getDevicePreferences(callback);
						case 'smarthomeDevices':						return alexa.getSmarthomeDevices(callback);
						case 'smarthomeGroups':							return alexa.getSmarthomeGroups(callback);
						case 'smarthomeEntities':						return alexa.getSmarthomeEntities(callback);
						case 'smarthomeBehaviourActionDefinitions': 	return alexa.getSmarthomeBehaviourActionDefinitions(callback);
						default: return reject(new Error('invalid get target'));
					}
				})
			}

			tools.initAndSend(node, msg, sendFun);
		});
	}
	RED.nodes.registerType("alexa-remote-get", AlexaRemoteGetNode)
}