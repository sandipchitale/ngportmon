import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TranslateModule } from '@ngx-translate/core';

import { PageNotFoundComponent } from './components/';
import { WebviewDirective } from './directives/';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { OverlayModule } from 'primeng/overlay';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ToolbarModule } from 'primeng/toolbar';
import { TreeModule } from 'primeng/tree';
import { TreeTableModule } from 'primeng/treetable';
import { SidebarModule } from 'primeng/sidebar';
import { SplitterModule } from 'primeng/splitter';

@NgModule({
  declarations: [PageNotFoundComponent, WebviewDirective],
  imports: [CommonModule, TranslateModule, FormsModule,
    CheckboxModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    InputTextareaModule,
    OverlayModule,
    SidebarModule,
    SplitterModule,
    TableModule,
    TabViewModule,
    ToggleButtonModule,
    ToolbarModule,
    TreeModule,
    TreeTableModule,
  ],
  exports: [TranslateModule, WebviewDirective, FormsModule,
    CheckboxModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    InputTextareaModule,
    OverlayModule,
    SidebarModule,
    SplitterModule,
    TableModule,
    TabViewModule,
    ToggleButtonModule,
    ToolbarModule,
    TreeModule,
    TreeTableModule,
  ]
})
export class SharedModule {}
