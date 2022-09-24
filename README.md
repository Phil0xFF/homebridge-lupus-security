
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# Homebridge Lupus Security XT2

This is a homebridge plugin for the Lupus Security XT2 alarm system.

## Installation

1. Install homebridge using the official instructions.
2. Search for "homebridge-lupus-security" in the homebridge UI or install this plugin using: `npm install -g homebridge-lupus-security`.

## Configuration

1. Add the Lupus Security XT2 platform to your homebridge configuration file. See the example below.

```json
{
    "platforms": [
      {
        "name": "Lupus Security",
        "lupusUrl": "http://127.0.0.1",
        "lupusUsername": "admin",
        "lupusPassword": "admin",
        "platform": "homebridge-lupus-security"
      }
    ]
}
```

2. Add two accessories to your homebridge configuration file. See the example below.

```json
{
    "accessories": [
      {
        "name": "Alarm Home",
        "accessory": "Alarm Home",
        "platform": "homebridge-lupus-security"
      },
      {
        "name": "Alarm Armed",
        "accessory": "Alarm Armed",
        "platform": "homebridge-lupus-security"
      }
    ]
}
```

3. Restart homebridge.

## Usage

The plugin will create a Lupus Security platform and two accessories.
- With the "Alarm Home" accessory you can set the alarm to home mode.
- With the "Alarm Armed" accessory you can set the alarm to armed mode.

## Troubleshooting
- If you got the error "No plugin was found for the platform "homebridge-lupus-security" in your config.json", you have to enter correct configuration values for the Lupus Security XT2 platform.
- If you got other errors, please open an issue on GitHub.

The plugin code is still very messy, but it works if everything is configured correctly. I will clean it up in the future.