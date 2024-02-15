/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-console */
import * as electron from 'electron';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { SortEvent } from 'primeng/api';

import {Component, Inject, NgZone, OnInit} from '@angular/core';
import { ElectronService } from './core/services';
import { TranslateService } from '@ngx-translate/core';
import { APP_CONFIG } from '../environments/environment';
import { ToggleButtonChangeEvent } from "primeng/togglebutton";
import {DOCUMENT} from "@angular/common";

const LIGHT_THEME = 'light-theme';
const DARK_THEME =  'dark-theme';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  darkTheme = false;

  public onlyPorts = '';
  public onlyPortsArray = [];
  public monitor = true;
  public listeningOnly = true;
  public wait = false;

  public updatedAt = new Date();

  public eportmonSettingsFilePath = path.join(os.homedir(), '.portmon.json');
  public eportmonSettings = {
    ports: '2910,5432,4200,8080,8765'
  };

  intervalId: NodeJS.Timeout | undefined;

  public ports: Array<any> = [];
  constructor(
    private ngZone: NgZone,
    private electronService: ElectronService,
    private translate: TranslateService,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.translate.setDefaultLang('en');
    console.log('APP_CONFIG', APP_CONFIG);

    if (electronService.isElectron) {
      console.log(process.env);
      console.log('Run in electron');
      console.log('Electron ipcRenderer', this.electronService.ipcRenderer);
      console.log('NodeJS childProcess', this.electronService.childProcess);
    } else {
      console.log('Run in browser');
    }
  }

  ngOnInit() {
    this.adjustTheme();
    this.loadSettings();
    this.startMonitoring();
  }

  adjustTheme() {
    const themeLink = this.document.getElementById('app-theme') as HTMLLinkElement;
    if (themeLink) {
      if (this.darkTheme) {
        themeLink.href = DARK_THEME + '.css';
      } else {
        themeLink.href = LIGHT_THEME + '.css';
      }
    }
  }

  public toggleMonitoring(event: ToggleButtonChangeEvent) {
    // first clear
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = undefined;
    }
    this.monitor = !this.monitor;
    if (event.checked) {
      this.startMonitoring();
    } else {
      this.stopMonitoring();
    }
  }
  public startMonitoring() {
    this.netstat();
    this.intervalId = setInterval(
      () => {
        this.netstat();
      }, 10000);
    this.monitor = true;
  }

  public stopMonitoring() {
    this.monitor = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = undefined;
    }
  }

  // save settings
  public saveSettings() {
    fs.writeFileSync(this.eportmonSettingsFilePath, JSON.stringify(this.eportmonSettings, null, '  '));
  }

  // load settings
  public loadSettings() {
    if (this.isFile(this.eportmonSettingsFilePath)) {
      try {
        this.eportmonSettings = JSON.parse(fs.readFileSync(this.eportmonSettingsFilePath, 'base64'));
      } catch (ignore) {
        //
      }
    } else {
      this.saveSettings();
    }
  }

  public customSort(event: SortEvent) {
    event.data?.sort((data1, data2) => {
      const value1 = data1[event.field as string];
      const value2 = data2[event.field as string];
      let result = null;

      if (value1 == null && value2 != null) {
        result = -1;
      } else if (value1 != null && value2 == null) {
        result = 1;
      } else if (value1 == null && value2 == null) {
        result = 0;
      } else {
        if (event.field === 'local' || event.field === 'pid') {
          const value1Int = parseInt(value1 as string, 10);
          const value2Int = parseInt(value2 as string, 10);
          result = (value1Int < value2Int) ? -1 : (value1Int > value2Int) ? 1 : 0;
        } else {
          result = value1.localeCompare(value2);
        }
      }
      return (result * (event.order || 1));
    });
  }

  portsChanged(event: KeyboardEvent) {
    if (event.key === 'ENTER') {
      this.eportmonSettings.ports = this.onlyPorts;
      this.saveSettings();
      this.doNetstat();
    } else {
      this.netstat();
    }
  }

  killProcess(event: MouseEvent, PID: any) {
    if (typeof PID === 'string') {
      PID = parseInt(PID, 10);
    }
    if (typeof PID === 'number') {
      if (!event.ctrlKey && !window.confirm('Kill process: ' + PID)) {
        return;
      }

      void this.ngZone.runOutsideAngular(() => {
        child_process.exec((os.platform() === 'win32' ? `taskkill /F /PID ${PID}` : `kill -9 ${PID}`), (err) => {
          if (err) {
            electron.dialog.showErrorBox(`Error`, `Failed to stop ${PID}`);
            return;
          }
          this.doNetstat();
        });
      });
    }
  }

  public netstat() {
    if (this.monitor) {
      this.doNetstat();
    }
  }

  public doNetstat() {
    const onlyPortsArray = this.onlyPorts.split(/,/)
      .filter((port) => port.trim().length > 0);

    this.wait = true;
    void this.ngZone.runOutsideAngular(() => {
      child_process.exec(`netstat -anop tcp`, (err, stdout : string) => {
        if (err) {
          console.error(err);
          return;
        }
        void this.ngZone.run(() => {
          this.wait = false;
          this.updatedAt = new Date();
          this.ports = [];
          const portLinesArray = stdout.split(/\r?\n/)
            .filter((portline) => portline.trim().length > 0)
            .map((portline) => portline.trim())
            .filter((portline) => !portline.trim().startsWith('Active Connections'))
            .filter((portline) => !portline.trim().startsWith('Proto'));
          portLinesArray.forEach(portLine => {
            const portLineParts = portLine.split(/\s+/);
            const port = portLineParts[1].replace(/[^:]+:/, '');
            if (onlyPortsArray.length === 0 || onlyPortsArray.includes(port)) {
              if (!this.listeningOnly || portLineParts[3] === 'LISTENING') {
                this.ports.push(
                  {
                    protocol: portLineParts[0],
                    local: port,
                    status: portLineParts[3],
                    pid: portLineParts[4]
                  },
                );
              }
            }
          });
        });
      });
    });
  }

  // Utility
  isFile(p: string): boolean {
    try {
      return fs.statSync(p) && fs.statSync(p).isFile();
    } catch (e) {
      return false;
    }
  }

  isDirectory(p: string): boolean {
    try {
      return fs.statSync(p) && fs.statSync(p).isDirectory();
    } catch (e) {
      return false;
    }
  }

  public github() {
    void (async () => {
      await electron.shell.openExternal('https://github.com/sandipchitale/portmon/');
    })();
  }

  public quit() {
    window.close();
  }
}
