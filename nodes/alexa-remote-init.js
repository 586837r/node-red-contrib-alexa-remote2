const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteInitNode(input) {
		RED.nodes.createNode(this, input);

		tools.assignNode(RED, this, ['account'], input);
		tools.nodeSetupForStatusReporting(this);

		this.onInput = function (msg) {
			if(!msg) msg = {};

			if(msg.payload === 'debug') {
				console.log(this);
				return;
			}

			if(msg.payload === 'stop') {
				this.account.stopAlexa();
				return;
			}

			if(msg.payload === 'refresh') {
				this.account.refreshAlexaCookie((err) => {
					const options = this.account.alexa._options;
					const regData = options && options.formerRegistrationData;
					tools.nodeErrVal(this, msg, err, regData);
				});
				return;
			}

			this.account.initAlexa(msg.payload, (err) => {
				const options = this.account.alexa._options;
				const regData = options && options.formerRegistrationData;
				tools.nodeErrVal(this, msg, err, regData);
			});
		}

		this.on('input', this.onInput);
	}
	RED.nodes.registerType("alexa-remote-init", AlexaRemoteInitNode);

	/*
	RED.httpAdmin.post("/alexa-remote-init/:id", RED.auth.needsPermission("config.write"), function(req, res){
		const node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
				const msg = {}
				const proxyRunning = node.account.status.code === 'wait-proxy';
				if(proxyRunning) {
					msg.payload = 'stop';
				}
				node.onInput(msg);
                res.sendStatus(200);
            } catch(err) {
                res.sendStatus(500);
                node.error(err);
            }
        } else {
            res.sendStatus(404);
        }
	})
	*/
}