const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteEventNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;

		tools.assign(node, ['event'], input);
		tools.assignNode(RED, node, ['account'], input);

		if(node.account){
			if(node.account.useWsMqtt){
				node.account.emitter.addListener('alexa-init', () => {
					node.status({ fill: "yellow", shape: "dot", text: "starting listening" });
					setTimeout(() => node.status({ fill: "grey", shape: "dot", text: "listening" }), 2000);
					node.account.alexa.addListener(node.event, val => {
						node.status({ fill: "blue", shape: "dot", text: "event fired!" });
						setTimeout(() => node.status({ fill: "grey", shape: "dot", text: "listening" }), 2000);
						node.send({ payload: val });
					});
				});
				if (node.account.initType !== 'manual') {
					node.account.initAlexa();
				}
			}
			else {
				node.status({ fill: "red", shape: "dot", text: "events not supported by account" });
			}
		}

		node.on('close', function (removed, done) { this.status({}); done(); });
	}
	RED.nodes.registerType("alexa-remote-event", AlexaRemoteEventNode)
}