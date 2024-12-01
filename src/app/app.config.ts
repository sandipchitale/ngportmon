import {ApplicationConfig, importProvidersFrom, provideZoneChangeDetection} from '@angular/core';

import {providePrimeNG} from 'primeng/config';
import Aura from '@primeng/themes/aura';
import {TranslateModule} from "@ngx-translate/core";
import {provideAnimations} from "@angular/platform-browser/animations";

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    importProvidersFrom( TranslateModule.forRoot()),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          prefix: 'p',
          darkModeSelector: '.dark-theme'
        }
      },
      ripple: true
    })]
};
