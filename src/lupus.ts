import axios from 'axios';

export interface LupusStatus {
    home: {
        armed: boolean;
    };
    alarm: {
        armed: boolean;
    };
}

/**
 * Lupus Class for handling HTTP calls to the lupusec xt2 alarm system.
 * - status of the alarm system
 * - arm the alarm system
 * - disarm the alarm system
 * - arm the home state
 * - disarm the home state
 *
 * 2 = Home Mode
 * 0 = Disarmed
 */
export class Lupus {
  url: string;
  username: string;
  password: string;

  constructor(url: string, username: string, password: string) {
    this.url = url;
    this.username = username;
    this.password = password;
  }

  /**
     * Get the status of the alarm system.
     */
  async getStatus(): Promise<LupusStatus> {
    const response = await axios.get(this.url + '/action/panelCondGet', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64'),
      },
    });

    // console.log('[HTTP] ' + response.status + ' ' + JSON.stringify(response.data));

    return {
      home: {
        armed: response.data.forms.pcondform1.mode === '2',
      },
      alarm: {
        armed: response.data.forms.pcondform1.mode === '1',
      },
    };
  }

  /**
   * Check if we get 200 OK from the lupusec.
   */
  async checkConnection(): Promise<boolean> {
    const response = await axios.get(this.url + '/action/panelCondGet', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64'),
      },
    });

    return response.status === 200;
  }

  /**
   * Get the x-token from the lupusec.
   */
  async getXToken(): Promise<string> {
    const response = await axios.get(this.url + '/action/tokenGet', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64'),
      },
    });

    return response.data.message;
  }

  /**
   * Set the alarm system to home mode.
   */
  async setHome(): Promise<void> {
    const xtoken = await this.getXToken();
    await axios.get(this.url + '/action/panelCondPost?area=1&mode=2', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64'),
        'X-Token': xtoken,
      },
    });
  }

  /**
   * Set alarm to arm.
   */
  async setAlarmArm(): Promise<void> {
    const xtoken = await this.getXToken();

    await axios.get(this.url + '/action/panelCondPost?area=1&mode=1', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64'),
        'X-Token': xtoken,
      },
    });
  }

  /**
   * Set the alarm system to disarmed mode.
   */
  async setDisarmed(): Promise<void> {
    const xtoken = await this.getXToken();

    await axios.get(this.url + '/action/panelCondPost?area=1&mode=0', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64'),
        'X-Token': xtoken,
      },
    });
  }
}