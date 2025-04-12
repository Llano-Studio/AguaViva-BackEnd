import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  private async loadTemplate(templateName: string): Promise<handlebars.TemplateDelegate> {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    const templateContent = await fs.promises.readFile(templatePath, 'utf-8');
    return handlebars.compile(templateContent);
  }

  async sendPasswordRecoveryEmail(email: string, token: string) {
    const template = await this.loadTemplate('password-recovery');
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    const html = template({
      resetUrl,
      name: email.split('@')[0],
    });

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Recuperación de contraseña - Sgarav',
      html,
    });
  }
} 