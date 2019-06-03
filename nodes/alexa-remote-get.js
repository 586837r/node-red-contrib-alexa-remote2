const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteGetNode(input) {
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
				case 'devices': 								return options.cached ? callback(null, Object.values(alexa.serialNumbers)) : alexa.getDevices(callback);
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
				default: 										return callback(new Error('Invalid get target'));
			}
		});
	}
	RED.nodes.registerType("alexa-remote-get", AlexaRemoteGetNode)
}