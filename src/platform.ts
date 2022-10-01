import {AccessoryPlugin, API, HAP, IndependentPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service} from 'homebridge';
import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {Lupus, LupusDevice, LupusStatus} from './lupus';
import {readFile} from 'fs/promises';

let hap: HAP;
let Accessory: typeof PlatformAccessory;

export = (api: API) => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLATFORM_NAME, ExampleIndependentPlatform);
};

class ExampleIndependentPlatform implements IndependentPlatformPlugin {

  private lupus: Lupus | undefined;
  private readonly log: Logging;
  private readonly api: API;

  private deviceList: LupusDevice[] = [];
  private alarmState: LupusStatus = {
    alarm: {
      armed: false,
    },
    home: {
      armed: false,
    },
  };

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.api = api;

    try {
      this.readConfigFile(api.user.configPath()).then((configCheck) => {
        if(!configCheck) {
          // eslint-disable-next-line max-len
          this.log.error('Error while initializing the plugin. Make sure you have entered the correct credentials in the config.json file (Error #2)');
          return;
        }

        if(this.lupus === undefined) {
          // eslint-disable-next-line max-len
          this.log.error('Error while initializing the plugin. Make sure you have entered the correct credentials in the config.json file (Error #3)');
          return;
        }

        this.lupus.getDeviceList().then((devices) => {
          this.publicAlarmSystemAccessory('LUPUS');

          this.deviceList = devices;
          devices.forEach((device) => {
            if(device.name !== '') {
              this.publicSensorAccessory(device.name);
            }
          });

          this.fetchDeviceListPeriodically();
          this.fetchAlarmSystemStatePeriodically();
        });
      });

    } catch (e) {
      // eslint-disable-next-line max-len
      this.log.error('Error while initializing the plugin. Make sure you have entered the correct credentials in the config.json file. (Error #1)');
    }
  }

  /* --------------------
   * Alarm System Service
   */

  publicAlarmSystemAccessory(name: string) {
    const uuid = hap.uuid.generate('homebridge:lupusec:alarm-system:' + name);
    const accessory = new Accessory('Alarm System', uuid);

    const alarmSystemService = new hap.Service.SecuritySystem(name);

    // create handlers for required characteristics
    alarmSystemService.getCharacteristic(hap.Characteristic.SecuritySystemCurrentState)
      .onGet(this.handleSecuritySystemCurrentStateGet.bind(this));

    alarmSystemService.getCharacteristic(hap.Characteristic.SecuritySystemTargetState)
      .onGet(this.handleSecuritySystemTargetStateGet.bind(this))
      .onSet(this.handleSecuritySystemTargetStateSet.bind(this));

    // set accessory information
    accessory.getService(hap.Service.AccessoryInformation)!
      .setCharacteristic(hap.Characteristic.Manufacturer, 'LUPUSEC')
      .setCharacteristic(hap.Characteristic.Model, 'Alarm System');

    // add the alarm system service to the accessory
    accessory.addService(alarmSystemService);

    this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);

    setInterval(() => {
      const currentState = alarmSystemService.getCharacteristic(hap.Characteristic.SecuritySystemCurrentState).value;
      const currentTargetState = this.getAlarmTargetState();

      this.log.debug('Current State: ' + currentState, 'Target State: ' + currentTargetState);

      if(currentState !== currentTargetState) {
        this.log.debug('Updating state to: ' + currentTargetState);
        alarmSystemService.updateCharacteristic(hap.Characteristic.SecuritySystemCurrentState, currentTargetState);
      }
    }, 1000 * 15);
  }

  /**
   * Handle requests to get the current value of the "Security System Current State" characteristic
   */
  handleSecuritySystemCurrentStateGet() {
    this.log.debug('Triggered GET SecuritySystemCurrentState');

    return this.getAlarmTargetState();
  }

  /**
   * Handle requests to get the current value of the "Security System Target State" characteristic
   */
  handleSecuritySystemTargetStateGet() {
    this.log.debug('Triggered GET SecuritySystemTargetState');

    // set this to a valid value for SecuritySystemTargetState
    return this.getAlarmTargetState();
  }

  /**
   * Handle requests to set the "Security System Target State" characteristic
   */
  handleSecuritySystemTargetStateSet(value) {
    if(this.lupus === undefined) {
      this.log.debug('LUPUS is not initialized');
      return;
    }

    this.log.debug('Triggered SET SecuritySystemTargetState:', value);

    switch (value) {
      case hap.Characteristic.SecuritySystemTargetState.DISARM:
      case hap.Characteristic.SecuritySystemTargetState.STAY_ARM:
        this.lupus.setDisarmed().then(() => {
          this.fetchAlarmSystemState();
        });
        break;
      case hap.Characteristic.SecuritySystemTargetState.AWAY_ARM:
        this.lupus.setAlarmArm().then(() => {
          this.fetchAlarmSystemState();
        });
        break;
      case hap.Characteristic.SecuritySystemTargetState.NIGHT_ARM:
        this.lupus.setHome().then(() => {
          this.fetchAlarmSystemState();
        });
        break;
    }
  }

  /* --------------
   * Sensor Service
   */

  publicSensorAccessory(name: string) {
    const uuid = hap.uuid.generate('homebridge:lupusec:sensor:' + name);
    const accessory = new Accessory(name, uuid);

    const sensorService = new hap.Service.ContactSensor(name);

    // create handlers for required characteristics
    sensorService.getCharacteristic(hap.Characteristic.ContactSensorState)
      .onGet(this.handleContactSensorStateGet.bind(this, accessory));

    // set accessory information
    accessory.getService(hap.Service.AccessoryInformation)!
      .setCharacteristic(hap.Characteristic.Manufacturer, 'LUPUSEC')
      .setCharacteristic(hap.Characteristic.Model, 'Sensor');

    // add the sensor service to the accessory
    accessory.addService(sensorService);

    this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);

    setInterval(() => {
      const device = this.deviceList.find((device) => device.name === name);

      if(!device) {
        return;
      }

      const currentState = sensorService.getCharacteristic(hap.Characteristic.ContactSensorState).value;
      const currentTargetState = device.status_ex;

      if(currentState !== currentTargetState) {
        sensorService.updateCharacteristic(hap.Characteristic.ContactSensorState, currentTargetState);
      }
    }, 1000 * 15);
  }

  /**
   * Handle requests to get the current value of the "Contact Sensor State" characteristic
   */
  handleContactSensorStateGet(accessory: PlatformAccessory) {
    const device = this.deviceList.find((device) => {
      return device.name === accessory.displayName;
    });

    if(!device) {
      return hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    }

    switch (device.status_ex) {
      case 0:
        return hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
      case 1:
        return hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
      default:
        return hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    }
  }

  /* -----
   * Utils
   */
  fetchDeviceListPeriodically() {
    setInterval(() => {
      if(this.lupus === undefined) {
        this.log.debug('LUPUS is not initialized');
        return;
      }

      this.lupus.getDeviceList().then((devices) => {
        this.deviceList = devices;
      });
    }, 1000 * 15);
  }

  fetchAlarmSystemStatePeriodically() {
    setInterval(() => {
      this.fetchAlarmSystemState();
    }, 1000 * 15);
  }

  fetchAlarmSystemState() {
    if(this.lupus === undefined) {
      this.log.debug('LUPUS is not initialized');
      return;
    }

    this.lupus.getStatus().then((state) => {
      this.log.debug('Alarm System State Updated', state);
      this.alarmState = state;
    });
  }

  /**
   * Get the current state of the alarm system.
   *
   * States:
   * 3: Disarmed
   * 2: Home
   * 1: Armed
   */
  getAlarmTargetState() {
    if(this.alarmState.alarm.armed) {
      return hap.Characteristic.SecuritySystemCurrentState.AWAY_ARM;
    }

    if(this.alarmState.home.armed) {
      return hap.Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
    }

    return hap.Characteristic.SecuritySystemCurrentState.DISARMED;
  }

  async readConfigFile(configPath: string): Promise<boolean> {
    const configRaw = await readFile(configPath);
    const config = JSON.parse(configRaw.toString());

    let result = false;
    await config.platforms.forEach((platform: any) => {
      if (platform.platform === 'HomebridgeLupusSecurity') {
        this.lupus = new Lupus(platform.lupusUrl, platform.lupusUsername, platform.lupusPassword);
        result = true;
      }
    });

    return result;
  }
}