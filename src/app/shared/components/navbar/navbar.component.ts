import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LucideChevronDown, LucideUser, LucideLogOut } from '@lucide/angular';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, LucideChevronDown, LucideUser, LucideLogOut],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  protected auth = inject(AuthService);

  menuAbierto = signal(false);

  toggleMenu() { this.menuAbierto.update(v => !v); }
  cerrarMenu() { this.menuAbierto.set(false); }

  logout() {
    this.auth.logout();
  }
}
