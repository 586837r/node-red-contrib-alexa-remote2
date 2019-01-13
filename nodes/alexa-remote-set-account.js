const tools = require('../tools/tools.js');

module.exports = function (RED) {

	function AlexaRemoteSetAccountNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;

		tools.assignNode(RED, node, ['account'], input);

		node.on('close', function (removed, done) { this.status({}); done(); });
		node.on('input', function (msg) {
			if (node.account) {
				
				tools.assign(node.account, [
					'alexaServiceHost',
					'userAgent',
					'amazonPage',
					'initType',
					'useWsMqtt',
					'bluetooth',
				], msg.payload);

				tools.assign(node.account.credentials, [
					'cookie', 'email', 'password'
				], msg.payload);

				tools.nodeOnSuccess(node, msg, undefined);
			}
			else {
				tools.nodeOnError(node, msg, new Error('account missing'));
			}
		});
	}
	RED.nodes.registerType("alexa-remote-set-account", AlexaRemoteSetAccountNode)
}