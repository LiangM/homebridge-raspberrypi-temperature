var Accessory, Service, Characteristic, UUIDGen;

const fs = require('fs');
const packageFile = require("./package.json");
const moment = require('moment');
var logger = require("mcuiot-logger").logger;
var os = require("os");
var hostname = os.hostname();

module.exports = function(homebridge) {
    if(!isConfig(homebridge.user.configPath(), "accessories", "RaspberryPiTemperature")) {
        return;
    }
    Service = homebridge.hap.Service;
    UUIDGen = homebridge.hap.uuid;
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
   // FakeGatoHistoryService = require('fakegato-history')(homebridge);
    homebridge.registerAccessory('homebridge-raspberrypi-temperature', 'RaspberryPiTemperature', RaspberryPiTemperature);
}

function isConfig(configFile, type, name) {
    var config = JSON.parse(fs.readFileSync(configFile));
    if("accessories" === type) {
        var accessories = config.accessories;
        for(var i in accessories) {
            if(accessories[i]['accessory'] === name) {
                return true;
            }
        }
    } else if("platforms" === type) {
        var platforms = config.platforms;
        for(var i in platforms) {
            if(platforms[i]['platform'] === name) {
                return true;
            }
        }
    } else {
    }
    
    return false;
}

function RaspberryPiTemperature(log, config) {
    if(null == config) {
        return;
    }

    this.log = log;
    this.name = config["name"];
    if(config["file"]) {
        this.readFile = config["file"];
    } else {
        this.readFile = "/sys/class/thermal/thermal_zone0/temp";
    }
    if(config["updateInterval"] && config["updateInterval"] > 0) {
        this.updateInterval = config["updateInterval"];
    } else {
        this.updateInterval = null;
    }
    this.spreadsheetId = config['spreadsheetId'];
    if (this.spreadsheetId) {
      this.log_event_counter = 59;
      this.logger = new logger(this.spreadsheetId);
    }
  //  this.loggingService = new FakeGatoHistoryService("weather", this); 
}

RaspberryPiTemperature.prototype = {
    getServices: function() {
        var that = this;
        
        var infoService = new Service.AccessoryInformation();
        infoService
            .setCharacteristic(Characteristic.Manufacturer, "RaspberryPi")
            .setCharacteristic(Characteristic.Model, "3B")
            .setCharacteristic(Characteristic.SerialNumber, hostname + "-" + "CPU Temp")
            .setCharacteristic(Characteristic.FirmwareRevision, packageFile.version);
        that.log("infoService: "+infoService);
        var raspberrypiService = new Service.TemperatureSensor(that.name);
        that.log("raspberrypiService: "+raspberrypiService);
        var currentTemperatureCharacteristic = raspberrypiService.getCharacteristic(Characteristic.CurrentTemperature);
        function getCurrentTemperature() {
            var data = fs.readFileSync(that.readFile, "utf-8");
            var temperatureVal = parseFloat(data) / 1000;
            that.log.debug("update currentTemperatureCharacteristic value: " + temperatureVal);
        /*    that.loggingService.addEntry({
                time: moment().unix(),
                temp: temperatureVal,
                pressure: 0,
                humidity: 0
          });
          */
            if (that.spreadsheetId) {
            that.log_event_counter = that.log_event_counter + 1;
            if (that.log_event_counter > 59) {
              that.logger.storeBME(that.name, 0, temperatureVal, 0, 0);
              that.log(that.name +" " + temperatureVal);
              that.log_event_counter = 0;
            }
          }
            return temperatureVal;
        }
        currentTemperatureCharacteristic.updateValue(getCurrentTemperature());
        if(that.updateInterval) {
            setInterval(() => {
                currentTemperatureCharacteristic.updateValue(getCurrentTemperature());
            }, that.updateInterval);
        }
        currentTemperatureCharacteristic.on('get', (callback) => {
            callback(null, getCurrentTemperature());
        });
        
        return [infoService, raspberrypiService];
    }
}
