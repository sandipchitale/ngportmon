import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

import {AfterViewInit, Component, inject, NgZone, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DatePipe, DOCUMENT} from "@angular/common";
import {ElectronService} from './core/services';
import {TranslateService} from '@ngx-translate/core';

import {APP_CONFIG} from '../environments/environment';

import {ButtonModule} from 'primeng/button';
import {TabsModule} from 'primeng/tabs';
import {SortIcon, TableModule} from 'primeng/table';
import {ToggleButtonModule} from 'primeng/togglebutton';
import {SelectButtonModule} from 'primeng/selectbutton';
import {ToolbarModule} from 'primeng/toolbar';
import {SortEvent} from 'primeng/api';
import {ToggleButtonChangeEvent} from "primeng/togglebutton/togglebutton.interface";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, ButtonModule, SelectButtonModule, FormsModule, SortIcon, TabsModule, TableModule, ToggleButtonModule, ToolbarModule],
  providers: [ElectronService, TranslateService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  private readonly document = inject(DOCUMENT);

  _darkTheme = false;

  LISTENING: string = os.platform() === 'win32' ? 'LISTENING' : 'LISTEN';

  connectionStatuses: any[] = [
    {name: this.LISTENING, value: 0},
    {name: 'ESTABLISHED', value: 1},
    {name: 'CLOSE_WAIT', value: 2},
    {name: 'TIME_WAIT', value: 3}
  ];

  _selectedConnectionStatuses: Array<number> = [0];

  ip46: any[] = [
    {name: 'IPv4', value: 0},
    {name: 'IPv6', value: 1}
  ];

  _selectedIp46: Array<number> = [0, 1];

  raw: string = '';

  public onlyPorts = '';
  public monitor = true;
  public wait = false;

  public updatedAt = new Date();

  public eportmonSettingsFilePath = path.join(os.homedir(), '.portmon.json');
  public eportmonSettings = {
    ports: this.onlyPorts
  };

  intervalId: NodeJS.Timeout | undefined;

  public ports: Array<any> = [];

  constructor(
    private ngZone: NgZone,
    private electronService: ElectronService,
    private translate: TranslateService
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
    this.translate.use('en');
    this.loadSettings();
    this.startMonitoring();
  }

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      this.document.querySelector('html')?.classList.remove('dark-theme');
      this.darkTheme = false;
    } else {
      this.document.querySelector('html')?.classList.add('dark-theme');
      this.darkTheme = false;
    }
  }

  get darkTheme(): boolean {
    return this._darkTheme;
  }

  set darkTheme(value: boolean) {
    this._darkTheme = value;
    if (this._darkTheme) {
      this.document.querySelector('html')?.classList.add('dark-theme');
    } else {
      this.document.querySelector('html')?.classList.remove('dark-theme');
    }
  }

  public get selectedConnectionStatuses(): Array<number> {
    return this._selectedConnectionStatuses;
  }

  public set selectedConnectionStatuses(value: Array<number>) {
    this._selectedConnectionStatuses = value;
    this.doNetstat();
  }

  public get selectedIp46(): Array<number> {
    return this._selectedIp46;
  }

  public set selectedIp46(value: Array<number>) {
    this._selectedIp46 = value;
    this.doNetstat();
  }

  public toggleMonitoring(event: ToggleButtonChangeEvent) {
    this.netstat();
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
    this.eportmonSettings.ports = this.onlyPorts;
    fs.writeFileSync(this.eportmonSettingsFilePath, JSON.stringify(this.eportmonSettings, null, '  '));
  }

  // load settings
  public loadSettings() {
    if (this.isFile(this.eportmonSettingsFilePath)) {
      try {
        this.eportmonSettings = JSON.parse(fs.readFileSync(this.eportmonSettingsFilePath, 'utf-8'));
        this.onlyPorts = this.eportmonSettings.ports;
      } catch (ignore) {
        console.error(ignore);
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
            this.electronService.dialog.showErrorBox(`Error`, `Failed to stop ${PID}`);
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
      const netstatCommand: string = (os.platform() === 'win32' ?
        'netstat -ano' :
        (os.platform() === 'darwin' ?
          'netstat -anvp tcp' :
          'netstat -anpt'));
      child_process.exec(netstatCommand, (err, stdout: string) => {
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
            .filter((portline) => !portline.trim().startsWith('Active '))
            .filter((portline) => !portline.trim().startsWith('Proto'));

          const protocolIndex = 0;
          const localAddressIndex = (os.platform() === 'win32' ? 1 : 3);
          const statusIndex = (os.platform() === 'win32' ? 3 : 5);
          const remoteAddrAndPortIndex = (os.platform() === 'win32' ? 2 : 4);
          const pidIndex = (os.platform() === 'win32' ? 4 : (os.platform() === 'darwin' ? 8 : 6));

          const rawPorts: Array<string> = [];
          try {
            portLinesArray.forEach(portLine => {
              const portLineParts = portLine.split(/\s+/);
              const rawPort = portLineParts[localAddressIndex];
              const ipv6 = (os.platform() === 'darwin' ? portLineParts[0] === 'tcp6' : rawPort.startsWith('['));
              const localAddr = (os.platform() === 'darwin' ? portLineParts[localAddressIndex].replace(/(.+)\.\d+/, '$1') : portLineParts[localAddressIndex].replace(/(.+):\d+/, '$1'));
              const port = (os.platform() === 'darwin' ? portLineParts[localAddressIndex].replace(/.+\.(\d+)/, '$1') : portLineParts[localAddressIndex].replace(/.+:(\d+)/, '$1'));
              if (onlyPortsArray.length === 0 || onlyPortsArray.includes(port)) {
                if (
                  (this._selectedConnectionStatuses.indexOf(0) !== -1 && portLineParts[statusIndex] === this.LISTENING) ||
                  (this._selectedConnectionStatuses.indexOf(1) !== -1 && portLineParts[statusIndex] === 'ESTABLISHED') ||
                  (this._selectedConnectionStatuses.indexOf(2) !== -1 && portLineParts[statusIndex] === 'CLOSE_WAIT') ||
                  (this._selectedConnectionStatuses.indexOf(3) !== -1 && portLineParts[statusIndex] === 'TIME_WAIT')
                ) {
                  if (this._selectedIp46.indexOf(0) === -1 && !ipv6) {
                    // Not IPv4
                    return;
                  }
                  if (this._selectedIp46.indexOf(1) === -1 && ipv6) {
                    // Not IPv6
                    return;
                  }
                  rawPorts.push(portLine)
                  if (os.platform() !== 'win32') {
                    portLineParts[pidIndex] = portLineParts[pidIndex].replace(/\/.+/, '')
                  }
                  this.ports.push(
                    {
                      protocol: portLineParts[protocolIndex],
                      localAddr: localAddr,
                      ipv6: ipv6,
                      local: port,
                      remoteAddrAndPort: portLineParts[remoteAddrAndPortIndex],
                      status: portLineParts[statusIndex],
                      pid: portLineParts[pidIndex]
                    },
                  );
                }
              }
            });
          } finally {
            this.raw = rawPorts.join('\n');
          }
        });
      });
    });
  }

  // Utility
  isFile(p: string): boolean {
    try {
      return fs.statSync(p) && fs.statSync(p).isFile();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return false;
    }
  }

  async gitHub() {
    await this.electronService.shell.openExternal('https://github.com/sandipchitale/ngportmon/');
  }

  quit() {
    window.close();
  }
}
