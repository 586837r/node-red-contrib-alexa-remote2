This node is for manual control of Account Node intialisation.
The associated Account Node should have *Auto Init* turned off to use this node.

---

### **Inputs**
 - **payload**
   - with the *Initialise* option the payload can be the previous authentication result, enabling automatic initialisation without the *File Path* setting (only in Proxy Auth Mode)

---

### **Outputs**
 - **payload**
   - with the *Initialise* option this is the authentication result that can be fed back into an Init node for automatic initialisation (only in Proxy Auth Mode)

---

### **Info**

Instead of saving the the Authentication result to a file specified in the Account Config Node you can also manually initialise the Account and save the Authentication result however you want. Here is an example how you can do that: 
```
[{"id":"bf44407a.c20d4","type":"alexa-remote-init","z":"c0bfc064.e8d26","name":"","account":"","option":"initialise","x":260,"y":2800,"wires":[["123e6678.5acbaa"]]},{"id":"c7f04444.fed188","type":"inject","z":"c0bfc064.e8d26","name":"","topic":"","payload":"alexa","payloadType":"flow","repeat":"","crontab":"00 12 * * 3,4,0","once":false,"onceDelay":0.1,"x":110,"y":2800,"wires":[["bf44407a.c20d4"]]},{"id":"123e6678.5acbaa","type":"change","z":"c0bfc064.e8d26","name":"","rules":[{"t":"set","p":"alexa","pt":"flow","to":"payload","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":420,"y":2800,"wires":[[]]}]
```

---

### **References**
 - [npm](https://npmjs.com/package/node-red-contrib-alexa-remote2) - the nodes npm repository
 - [GitHub](https://github.com/586837r/node-red-contrib-alexa-remote2) - the nodes GitHub repository