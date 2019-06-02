const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteInitNode(input) {
		RED.nodes.createNode(this, input);

		tools.assignNode(RED, this, ['account'], input);
		this.autoInit = input.autoInit === 'on';

		this.stopBlinking = function() {
			if(this.blinkInterval) {
				clearInterval(this.blinkInterval);
				this.blinkInterval = null;
			}
			this.status({}); 
		}
		this.startBlinking = function(text) {
			this.blinkInterval = setInterval(() => {
				this.blinkState = !this.blinkState;
				const fill = this.blinkState ? 'blue' : 'grey';
				this.status({ shape: 'dot', fill: fill, text: text});
			}, 300);
		}
		this.onInput = function (msg) {
			if(!msg) msg = {}

			if(msg.debug) {
				console.log(this);
				return;
			}

			if(msg.stop) {
				this.account.stopAlexa();
				return;
			}

			this.account.initAlexa(msg.payload, (err) => {
				console.log(`CALLBACK: alexa-remote-init`, err);
				const options = this.account.alexa._options;
				const regData = options && options.formerRegistrationData;
				tools.nodeErrVal(this, msg, err, regData, 'ready');
			});
		}

		this.account.emitter.on('status', (code, message) => {
			this.stopBlinking(); 

			switch(code) {
				case 'init-proxy': 		this.status({shape: 'ring', fill: 'grey', text: 'starting proxy' }); break;
				case 'init-cookie': 	this.status({shape: 'ring', fill: 'grey', text: 'init with cookie' }); break;
				case 'init-password': 	this.status({shape: 'ring', fill: 'grey', text: 'init with password' }); break;
				case 'wait-proxy': 		this.startBlinking(message); break;
				case 'stop':			this.status({shape: 'ring', fill: 'yellow', text: 'stopped'}); break;
				case 'done': 			this.status({shape: 'dot', fill: 'green', text: 'ready'}); break;
			}
		});

		if(this.autoInit) {
			this.onInput({});
		}

		this.on('close', function () { 
			this.stopBlinking();
		});
		this.on('input', this.onInput);
	}
	RED.nodes.registerType("alexa-remote-init", AlexaRemoteInitNode)

	RED.httpAdmin.post("/alexa-remote-init/:id", RED.auth.needsPermission("config.write"), function(req, res){
		const node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
				const msg = {}
				const proxyRunning = node.account.status.code === 'wait-proxy';
				console.log({status: node.account.status, running:proxyRunning});
				if(proxyRunning) {
					msg.stop = true;
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
}