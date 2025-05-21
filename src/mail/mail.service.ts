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
  private testAccount: any = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    try {
      // Siempre usar Ethereal para desarrollo
      this.logger.log('Creando cuenta de prueba Ethereal para emails de desarrollo...');
      this.testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: this.testAccount.user,
          pass: this.testAccount.pass,
        },
      });
      
      this.logger.log(`Cuenta de prueba creada: ${this.testAccount.user}`);
      this.logger.log(`Para ver los correos enviados, visita: https://ethereal.email/login`);
      this.logger.log(`Usuario: ${this.testAccount.user}`);
      this.logger.log(`Contraseña: ${this.testAccount.pass}`);
    } catch (error) {
      this.logger.error('Error al inicializar el servicio de correo:', error.stack);
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
      const template = await this.loadTemplate('password-recovery');
      const resetUrl = `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/auth/resetear-clave?token=${token}`;
      const currentYear = new Date().getFullYear();
      
      const html = template({
        resetUrl,
        name: email.split('@')[0],
        currentYear,
      });

      const info = await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM') || 'noreply@aguaviva.com',
        to: email,
        subject: 'Recuperación de contraseña - Agua Viva',
        html,
      });
      
      this.logger.log(`Correo de recuperación enviado a ${email}`);
      
      // Mostrar el enlace para ver el correo de prueba
      this.logger.log(`URL de vista previa: ${nodemailer.getTestMessageUrl(info)}`);
    } catch (error) {
      this.logger.error(`Error al enviar correo de recuperación a ${email}`, error.stack);
      throw new InternalServerErrorException('Error al enviar el correo de recuperación.');
    }
  }
} 