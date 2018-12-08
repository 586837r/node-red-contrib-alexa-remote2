const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteEventNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;

		tools.assign(node, ['event'], input);
		tools.assignNode(RED, node, ['account'], input);

		node.initCallback = function() {
			node.warn('account init');
			node.status({ fill: "yellow", shape: "dot", text: "starting listening" });
			setTimeout(() => node.status({ fill: "grey", shape: "dot", text: "listening" }), 2000);
			node.account.alexa.addListener(node.event, val => {
				node.status({ fill: "blue", shape: "dot", text: "event fired!" });
				setTimeout(() => node.status({ fill: "grey", shape: "dot", text: "listening" }), 2000);
				node.send({ payload: val });
			});
		};

		node.on('close', function (removed, done) { this.status({}); done(); });

		if(!node.account)
			return node.status({ fill: "red", shape: "dot", text: "account missing" });

		if(!node.account.useWsMqtt)
			return node.status({ fill: "red", shape: "dot", text: "events not supported by account" });

		node.account.emitter.removeListener('alexa-init', node.initCallback);
		node.account.emitter.addListener('alexa-init', node.initCallback);
		if (node.account.initType !== 'manual') {
			node.account.initAlexa();
		}
	}
	RED.nodes.registerType("alexa-remote-event", AlexaRemoteEventNode)
}