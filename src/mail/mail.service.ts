import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private mailerSend: MailerSend;
  private readonly logger = new Logger(MailService.name);
  private sender: Sender;

  constructor(private readonly configService: ConfigService) {
    this.initializeMailerSend();
  }

  private initializeMailerSend() {
    try {
      const apiKey = this.configService.get<string>('MAILERSEND_API_KEY');
      
      if (!apiKey) {
        this.logger.warn('MAILERSEND_API_KEY no configurado. El servicio de correo no funcionará correctamente.');
        return;
      }

      this.mailerSend = new MailerSend({
        apiKey: apiKey,
      });

      // Configurar el remitente por defecto
      const fromEmail = this.configService.get<string>('MAIL_FROM') || 'noreply@aguasrica.com.ar';
      const fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'Agua Viva Rica';
      
      this.sender = new Sender(fromEmail, fromName);
      
      this.logger.log('MailerSend inicializado correctamente');
      this.logger.log(`Remitente configurado: ${fromName} <${fromEmail}>`);
    } catch (error) {
      this.logger.error('Error al inicializar MailerSend:', error.stack);
      throw new InternalServerErrorException('Error al inicializar el servicio de correo');
    }
  }

  private async loadTemplate(templateName: string): Promise<handlebars.TemplateDelegate> {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    try {
      const content = await fs.promises.readFile(templatePath, 'utf-8');
      return handlebars.compile(content);
    } catch (err) {
      this.logger.error(`No se pudo cargar la plantilla ${templateName}`, err.stack);
      throw new InternalServerErrorException(`No se pudo cargar la plantilla ${templateName}`);
    }
  }

  async sendPasswordRecoveryEmail(email: string, token: string) {
    try {
      if (!this.mailerSend) {
        this.logger.error('MailerSend no está inicializado');
        throw new InternalServerErrorException('Servicio de correo no disponible');
      }

      const template = await this.loadTemplate('password-recovery');
      const resetUrl = `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/auth/resetear-clave?token=${token}`;
      const currentYear = new Date().getFullYear();
      
      const html = template({
        resetUrl,
        name: email.split('@')[0],
        currentYear,
      });

      const recipients = [new Recipient(email, email.split('@')[0])];

      const emailParams = new EmailParams()
        .setFrom(this.sender)
        .setTo(recipients)
        .setSubject('Recuperación de contraseña - Agua Viva Rica')
        .setHtml(html);

      const response = await this.mailerSend.email.send(emailParams);
      
      this.logger.log(`Correo de recuperación enviado a ${email}`);
      this.logger.log(`ID del mensaje: ${response.headers['x-message-id'] || 'N/A'}`);
      
      return { success: true, messageId: response.headers['x-message-id'] };
    } catch (error) {
      this.logger.error(`Error al enviar correo de recuperación a ${email}`, error.stack);
      throw new InternalServerErrorException('Error al enviar el correo de recuperación.');
    }
  }

  async sendConfirmationEmail(email: string, name: string, confirmationToken: string) {
    try {
      if (!this.mailerSend) {
        this.logger.error('MailerSend no está inicializado');
        throw new InternalServerErrorException('Servicio de correo no disponible');
      }

      const template = await this.loadTemplate('email-confirmation');
      const confirmationUrl = `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/auth/confirmar-email?token=${confirmationToken}`;
      const currentYear = new Date().getFullYear();
      
      const html = template({
        confirmationUrl,
        name: name || email.split('@')[0],
        currentYear,
      });

      const recipients = [new Recipient(email, name || email.split('@')[0])];

      const emailParams = new EmailParams()
        .setFrom(this.sender)
        .setTo(recipients)
        .setSubject('Confirma tu cuenta - Agua Viva Rica')
        .setHtml(html);

      const response = await this.mailerSend.email.send(emailParams);
      
      this.logger.log(`Correo de confirmación enviado a ${email}`);
      this.logger.log(`ID del mensaje: ${response.headers['x-message-id'] || 'N/A'}`);
      
      return { success: true, messageId: response.headers['x-message-id'] };
    } catch (error) {
      this.logger.error(`Error al enviar correo de confirmación a ${email}`, error.stack);
      throw new InternalServerErrorException('Error al enviar el correo de confirmación.');
    }
  }

  async sendWelcomeEmail(email: string, name: string) {
    try {
      if (!this.mailerSend) {
        this.logger.error('MailerSend no está inicializado');
        throw new InternalServerErrorException('Servicio de correo no disponible');
      }

      const template = await this.loadTemplate('welcome');
      const currentYear = new Date().getFullYear();
      
      const html = template({
        name: name || email.split('@')[0],
        currentYear,
        loginUrl: `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/auth/login`,
      });

      const recipients = [new Recipient(email, name || email.split('@')[0])];

      const emailParams = new EmailParams()
        .setFrom(this.sender)
        .setTo(recipients)
        .setSubject('¡Bienvenido a Agua Viva Rica!')
        .setHtml(html);

      const response = await this.mailerSend.email.send(emailParams);
      
      this.logger.log(`Correo de bienvenida enviado a ${email}`);
      this.logger.log(`ID del mensaje: ${response.headers['x-message-id'] || 'N/A'}`);
      
      return { success: true, messageId: response.headers['x-message-id'] };
    } catch (error) {
      this.logger.error(`Error al enviar correo de bienvenida a ${email}`, error.stack);
      throw new InternalServerErrorException('Error al enviar el correo de bienvenida.');
    }
  }
}