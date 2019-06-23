Enables control over Account Node intialisation.
The associated Account Node should have *Auto Init* turned off to use this node.

---

### **Inputs**
 - **payload**
   - `"stop"` to stop the initialisation
   - `"refresh"` to refresh the cookie (only in proxy authentication mode)
   - any other payload will initialise the account
     - if authentification mode is *proxy*, then you can send the output of the last
initialisation for automatic initialisation

---

### **Outputs**
 - **payload**
   - if authentication mode is *proxy* and on success this will be an object that you can
send to this node later for automatic initialisation

---

### **References**
 - [npm](https://npmjs.com/package/node-red-contrib-alexa-remote2) - the nodes npm repository
 - [GitHub](https://github.com/586837r/node-red-contrib-alexa-remote2) - the nodes GitHub repository