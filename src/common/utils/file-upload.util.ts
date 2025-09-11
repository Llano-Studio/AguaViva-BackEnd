import { extname } from 'path';
import { diskStorage } from 'multer';

/**
 * Genera un nombre único para el archivo subido
 */
export const editFileName = (req: any, file: any, callback: (error: Error | null, filename: string) => void) => {
  const name = file.originalname.split('.')[0];
  const fileExtName = extname(file.originalname);
  const randomName = Array(4)
    .fill(null)
    .map(() => Math.round(Math.random() * 16).toString(16))
    .join('');
  callback(null, `${name}-${randomName}${fileExtName}`);
};

/**
 * Filtro para validar archivos de imagen
 */
export const imageFileFilter = (req: any, file: any, callback: (error: Error | null, acceptFile: boolean) => void) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    return callback(new Error('¡Solo se permiten archivos de imagen (jpg, jpeg, png, gif, webp)!'), false);
  }
  callback(null, true);
};

/**
 * Configuraciones predefinidas para diferentes tipos de archivos
 */
export const fileUploadConfigs = {
  /**
   * Configuración para imágenes de perfil de usuario
   */
  profileImages: {
    storage: diskStorage({
      destination: './public/uploads/profile-images',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    }
  },

  /**
   * Configuración para imágenes de productos
   */
  productImages: {
    storage: diskStorage({
      destination: './public/uploads/products',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    }
  },

  /**
   * Configuración para evidencias de entrega
   */
  deliveryEvidence: {
    storage: diskStorage({
      destination: './public/uploads/evidence',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB para evidencias
    }
  },

  /**
   * Configuración para contratos de comodato
   */
  contractImages: {
    storage: diskStorage({
      destination: './public/uploads/contracts',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB para contratos
    }
  }
};

export const buildImageUrl = (fileName: string | null, folder: 'profile-images' | 'products' | 'evidence' | 'delivery-evidence' | 'reconciliations' | 'contracts'): string | null => {
  if (!fileName) {
    return null;
  }
  return `http://localhost:3000/public/uploads/${folder}/${fileName}`;
};