import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import {
  LucideLayoutGrid,
  LucideFolder,
  LucideClipboardList,
  LucideMonitor,
  LucideFolderOpen,
  LucideBuilding2,
  LucideUsers,
  LucideBarChart3,
  LucideCirclePlus,
  LucideChevronLeft,
  LucideChevronRight
} from '@lucide/angular';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink, RouterLinkActive, CommonModule,
    LucideLayoutGrid, LucideFolder, LucideClipboardList, LucideMonitor,
    LucideFolderOpen, LucideBuilding2, LucideUsers, LucideBarChart3,
    LucideCirclePlus, LucideChevronLeft, LucideChevronRight
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  protected auth = inject(AuthService);
  collapsed = signal(false);
  toggle() { this.collapsed.update(v => !v); }
}
