import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @Output() loginSuccess = new EventEmitter<void>();

  // Form input signals
  email = signal<string>('');
  password = signal<string>('');
  showPassword = signal<boolean>(false);

  // Forgot password flow signals
  isForgotMode = signal<boolean>(false);
  forgotEmail = signal<string>('');
  forgotSuccessMessage = signal<string | null>(null);
  forgotErrorMessage = signal<string | null>(null);
  isSubmittingForgot = signal<boolean>(false);

  // Login UI signals
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  toggleShowPassword(): void {
    this.showPassword.update((val) => !val);
  }

  async onLoginSubmit(): Promise<void> {
    const emailVal = this.email().trim();
    const passwordVal = this.password();

    if (!emailVal) {
      this.errorMessage.set('Please enter your Quest account email.');
      return;
    }
    if (!passwordVal) {
      this.errorMessage.set('Please enter your password.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      await this.authService.login(emailVal, passwordVal);
      this.loginSuccess.emit();
      await this.router.navigate(['/']);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Login failed. Please verify your credentials.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  switchToForgotMode(): void {
    this.isForgotMode.set(true);
    this.forgotEmail.set(this.email().trim());
    this.forgotSuccessMessage.set(null);
    this.forgotErrorMessage.set(null);
    this.errorMessage.set(null);
  }

  switchToLoginMode(): void {
    this.isForgotMode.set(false);
    this.forgotSuccessMessage.set(null);
    this.forgotErrorMessage.set(null);
  }

  async onForgotPasswordSubmit(): Promise<void> {
    const emailVal = this.forgotEmail().trim();
    if (!emailVal) {
      this.forgotErrorMessage.set('Please provide your registered Quest email.');
      return;
    }

    this.isSubmittingForgot.set(true);
    this.forgotErrorMessage.set(null);
    this.forgotSuccessMessage.set(null);

    try {
      await this.authService.sendPasswordReset(emailVal);
      this.forgotSuccessMessage.set(
        'Password reset instructions have been sent to your email. Check your inbox.'
      );
    } catch (err: any) {
      this.forgotErrorMessage.set(err?.message || 'Unable to send reset email. Please try again.');
    } finally {
      this.isSubmittingForgot.set(false);
    }
  }
}
