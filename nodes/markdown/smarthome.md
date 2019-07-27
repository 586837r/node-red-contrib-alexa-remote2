Interface to Smarthome features.

---

### **Info**

- **Action** and **Query** let you send multiple commands/requests at once. You can increase the *Outputs* to split the message by the Items in the list. For example if you have 3 items in the list and 3 outputs then each output corresponds to one item. If you have less outputs than items then the last output will have an array of messages. You can have the same Appliance multiple times in the list. 
Each item in the list creates its own message on success and its own error on failure.

- **Color** can be a color name (case and non-alpha insensitive) or a hex value like `#FF0000` or `FF0000`
- **Color Temperature** can be a color temperature name (case and non-alpha insensitive), a Kelvin value or a hex value like `#FF0000` or `FF0000`

---

### **References**
 - [npm](https://npmjs.com/package/node-red-contrib-alexa-remote2) - the nodes npm repository
 - [GitHub](https://github.com/586837r/node-red-contrib-alexa-remote2) - the nodes GitHub repository