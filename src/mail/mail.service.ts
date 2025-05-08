import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: this.configService.get<string>('MAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
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
      const template = await this.loadTemplate('password-recovery');
      const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${token}`;
      const currentYear = new Date().getFullYear();
      
      const html = template({
        resetUrl,
        name: email.split('@')[0],
        currentYear,
      });

      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM'),
        to: email,
        subject: 'Recuperación de contraseña - Sgarav',
        html,
      });
      this.logger.log(`Correo de recuperación enviado a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar correo de recuperación a ${email}`, error.stack);
      // Decide si quieres lanzar una excepción aquí o manejarlo de otra forma
      // Por ahora, solo lo logueamos para no interrumpir el flujo si el envío de correo es secundario
      // throw new InternalServerErrorException('Error al enviar el correo de recuperación.');
    }
  }
} 