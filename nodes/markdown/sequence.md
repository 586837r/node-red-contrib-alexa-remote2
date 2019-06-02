Executes commands related to music.

---

### **Inputs**
 - **sequence** *(optional, overrides)*
   - must be an array of objects with a `command` property that must be one of 
`speak`, `volume`, `deviceStop`, `notification`, `ssml`, `goodmorning`, `weather`,`traffic`, `flashbriefing`, `singasong`, `tellstory`, `calendarNext`, `calendarToday`, `calendarTomorrow` 
   - value must also be defined if the `command` is `speak`, `ssml` or `volume`*(0-100)*
  
---

### **Outputs**
 - **payload**
   - response from amazon

---

### **References**
 - [npm](https://npmjs.com/package/node-red-contrib-alexa-remote2) - the nodes npm repository
 - [GitHub](https://github.com/586837r/node-red-contrib-alexa-remote2) - the nodes GitHub repository