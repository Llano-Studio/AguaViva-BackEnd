import { extname } from 'path';
import { diskStorage } from 'multer';

/**
 * Genera un nombre único para el archivo subido
 */
export const editFileName = (
  req: any,
  file: any,
  callback: (error: Error | null, filename: string) => void,
) => {
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
export const imageFileFilter = (
  req: any,
  file: any,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    return callback(
      new Error(
        '¡Solo se permiten archivos de imagen (jpg, jpeg, png, gif, webp)!',
      ),
      false,
    );
  }
  callback(null, true);
};

/**
 * Filtro para validar archivos de contrato (imágenes y PDFs)
 */
export const contractFileFilter = (
  req: any,
  file: any,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i)) {
    return callback(
      new Error(
        '¡Solo se permiten archivos de imagen (jpg, jpeg, png, gif, webp) o PDF (pdf)!',
      ),
      false,
    );
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
    },
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
    },
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
    },
  },

  /**
   * Configuración para contratos de comodato (imágenes y PDFs)
   */
  contractImages: {
    storage: diskStorage({
      destination: './public/uploads/contracts',
      filename: editFileName,
    }),
    fileFilter: contractFileFilter,
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB para contratos
    },
  },
};

export const buildImageUrl = (
  fileName: string | null,
  folder:
    | 'profile-images'
    | 'products'
    | 'evidence'
    | 'delivery-evidence'
    | 'reconciliations'
    | 'contracts',
): string | null => {
  if (!fileName) {
    return null;
  }

  // Limpiar el fileName si contiene [object File] o paths problemáticos
  let cleanFileName = fileName;

  // Si contiene [object File], extraer solo el nombre del archivo si está disponible
  if (fileName.includes('[object File]')) {
    // Si es un path completo con [object File], intentar extraer el nombre real del archivo
    const pathMatch = fileName.match(/\/uploads\/[^\/]+\/(.+)$/);
    if (pathMatch && pathMatch[1] && !pathMatch[1].includes('[object File]')) {
      cleanFileName = pathMatch[1];
    } else {
      // Si no se puede extraer un nombre válido, retornar null
      return null;
    }
  }

  // Si el fileName ya es un path completo, extraer solo el nombre del archivo
  if (cleanFileName.includes('/uploads/')) {
    const pathMatch = cleanFileName.match(/\/uploads\/[^\/]+\/(.+)$/);
    if (pathMatch && pathMatch[1]) {
      cleanFileName = pathMatch[1];
    }
  }

  // Determinar base URL desde variables de entorno
  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';

  // Asegurar que no tenga slash final duplicado
  const normalizedBase = baseUrl.replace(/\/$/, '');

  return `${normalizedBase}/public/uploads/${folder}/${cleanFileName}`;
};
