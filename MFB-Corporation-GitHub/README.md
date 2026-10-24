# MFB Corporation

18 herramientas gratuitas en español para imágenes, PDF, códigos QR, texto, cálculos y organización.

## Publicar en GitHub Pages

1. Descomprime el ZIP en tu computadora.
2. Crea un repositorio público en GitHub, por ejemplo mfb-corporation.
3. En Add file → Upload files, sube el CONTENIDO de la carpeta descomprimida. index.html debe quedar en la raíz del repositorio. Incluye assets, las carpetas de páginas, site-config.json y .github. No subas el ZIP como único archivo.
4. Confirma los archivos con Commit changes en la rama main.
5. En Settings → Pages → Build and deployment → Source, elige GitHub Actions.
6. En Actions, selecciona Publicar MFB Corporation y pulsa Run workflow. Si el primer intento se ejecutó antes de activar Pages y falló, vuelve a ejecutarlo después del paso 5.
7. Cuando termine, abre Settings → Pages → Visit site.

No necesitas instalar Node, comprar un dominio o contratar un servidor para esta versión estática. El archivo de publicación ya está incluido. No se ha publicado en tu cuenta automáticamente: debes completar los pasos anteriores.

Es importante que .github/workflows/pages.yml aparezca en tu repositorio. Si la carga web omitió esa carpeta, sube su contenido conservando la misma ruta o usa GitHub Desktop.

## Qué contiene

- index.html: página inicial.
- assets: estilos, tipografía, configuración, imágenes y JavaScript.
- herramientas: 18 páginas con utilidades.
- guias: cuatro guías prácticas y su índice.
- acerca, privacidad, terminos, contacto, colabora y lanzamiento.
- .github: preparación del sitio y publicación automática.
- .nojekyll: permite usar también alojamiento estático directo.
- site-config.json: configuración pública del proyecto.

## Configuración del proyecto

Edita site-config.json en GitHub para añadir:

- contactEmail: un correo público del proyecto.
- supportUrl: un enlace HTTPS real de apoyo voluntario.
- sponsor: una colaboración real con los campos name, description y url. Deja null mientras no exista.

Ejemplo de patrocinio:

    "sponsor": {
      "name": "Tu patrocinador",
      "description": "Una descripción breve y verificable.",
      "url": "https://ejemplo.com"
    }

Cada cambio en main vuelve a ejecutar la publicación. El proceso prepara las URL del sitio, sus metadatos y sitemap.xml para tu dirección real de GitHub Pages. También admite un dominio propio configurado en Pages.

No guardes contraseñas, claves privadas ni datos de tarjetas en site-config.json: sus valores son públicos. Los anuncios de AdSense y los cobros no están activados. Los patrocinios, apoyos y anuncios requieren conectar servicios y acuerdos reales.

## Funcionamiento

Las herramientas se ejecutan en el navegador. Las imágenes y los textos no se envían a un servidor de la aplicación. Favoritos, notas y tareas se guardan en ese navegador y dispositivo.

Imágenes: JPG, PNG y WebP, hasta 25 MB por archivo. PDF: hasta 12 imágenes, con un máximo de 40 MB en total. No incluye OCR. Mantén copias de tus originales.

Las calculadoras son informativas. Los impuestos se introducen manualmente y las notas no aplican reglas particulares de una institución.

## Licencias de bibliotecas

Se conservan las licencias de qrcode-generator, pdf-lib y Manrope junto a los archivos correspondientes. Deben mantenerse al redistribuir estas bibliotecas.

## Documentación oficial

https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
