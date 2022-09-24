import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from 'homebridge';
import { Lupus } from './lupus';
import { readFile } from "fs/promises";

let hap: HAP;
let lupus: any = null;

/*
 * Initializer function called when the plugin is loaded.
 */
export = async (api: API) => {
  hap = api.hap;

  const configRaw = await readFile(api.user.configPath());
  const config = JSON.parse(configRaw.toString());

  config.platforms.forEach((platform: any) => {
    if (platform.platform === 'homebridge-lupus-security') {
      console.log('Configuring Lupus Security platform...');
      lupus = new Lupus(platform.lupusUrl, platform.lupusUsername, platform.lupusPassword);
    }
  });

  if(lupus) {
    api.registerAccessory('Alarm Home', AlarmHome);
    api.registerAccessory('Alarm Armed', AlarmArmed);
  } else {
    console.log('Lupus not configured, skipping alarm accessories.');
  }
};



class AlarmHome implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;
  private switchOn = false;

  private readonly switchService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = 'Alarm Home';

    // get current status of the home alarm
    lupus.getStatus().then((status) => {
      this.switchOn = status.home.armed;
    });

    this.switchService = new hap.Service.Switch(this.name);
    this.switchService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("[Lupus] " + this.name + " is " + (this.switchOn? "ARM": "DISARM"));
        callback(undefined, this.switchOn);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.switchOn = value as boolean;
        log.info("[Lupus] " + this.name + " set to " + (this.switchOn? "ARM": "DISARM"));

        if(this.switchOn) {
          lupus.setHome();
        } else {
          lupus.setDisarmed();
        }

        callback();
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "LUPUSEC")
      .setCharacteristic(hap.Characteristic.Model, "XT2");

    log.info("[Lupus] " + this.name + " initialized!");

    this.getCurrentStatus();

  }

  /**
   * Get the status of the alarm system.
   * Run this function every 10 seconds to get the status of the alarm system.
   */
  async getCurrentStatus(): Promise<void> {
    setTimeout(async () => {
      if(lupus) {
        const status = await lupus.getStatus();

        this.switchOn = status.home.armed;
        this.switchService.getCharacteristic(hap.Characteristic.On).updateValue(this.switchOn);

        console.log('[Lupus] ' + this.name + ' is ' + (this.switchOn? "HOME": "DISARM"));
      }

      this.getCurrentStatus();
    }, 1000 * 60);
  }

  identify(): void {
    // don't need to do anything here
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ];
  }
}

class AlarmArmed implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;
  private switchOn = false;

  private readonly switchService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = 'Alarm Armed';

    // get current status of the home alarm
    lupus.getStatus().then((status) => {
      this.switchOn = status.alarm.armed;
    });

    this.switchService = new hap.Service.Switch(this.name);
    this.switchService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("[Lupus] " + this.name + " is " + (this.switchOn? "ARM": "DISARM"));
        callback(undefined, this.switchOn);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.switchOn = value as boolean;
        log.info("[Lupus] " + this.name + " set to " + (this.switchOn? "ARM": "DISARM"));

        if(this.switchOn) {
          lupus.setAlarmArm();
          setTimeout(() => {
            this.getCurrentStatusSingle();
          }, 1000 * 2);
        } else {
          lupus.setDisarmed();
        }

        callback();
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "LUPUSEC")
      .setCharacteristic(hap.Characteristic.Model, "XT2");

    log.info("[Lupus] " + this.name + " initialized!");

    this.getCurrentStatus();
  }

  /**
   * Get the status of the alarm system.
   * Run this function every 10 seconds to get the status of the alarm system.
   */
  async getCurrentStatus(): Promise<void> {
    setTimeout(async () => {
      const status = await lupus.getStatus();

      this.switchOn = status.alarm.armed;
      this.switchService.getCharacteristic(hap.Characteristic.On).updateValue(this.switchOn);

      console.log('[Lupus] ' + this.name + ' is ' + (this.switchOn? "ARMED": "DISARM"));

      this.getCurrentStatus();
    }, 1000 * 60);
  }

  async getCurrentStatusSingle(): Promise<void> {
    const status = await lupus.getStatus();

    this.switchOn = status.alarm.armed;
    this.switchService.getCharacteristic(hap.Characteristic.On).updateValue(this.switchOn);

    console.log('[Lupus] ' + this.name + ' is ' + (this.switchOn? "ARMED": "DISARM"));
  }

  identify(): void {
    // don't need to do anything here
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ];
  }
}
