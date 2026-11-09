/**
 * CONFIGURACIÓN GLOBAL EN LA NUBE (PARA TODOS LOS DISPOSITIVOS: PAPÁ Y RECEPCIONISTAS)
 * Al colocar aquí el URL y ANON_KEY de Supabase, cualquier celular o PC que abra el link
 * se conectará automáticamente a la misma base de datos en tiempo real sin configurar nada.
 */
window.GYM_CLOUD_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  // Por seguridad en el link web, los dispositivos nuevos inician en Modo Recepción
  // hasta que tu papá ingrese su Clave de Administrador.
  DEFAULT_ROLE_NEW_DEVICE: 'RECEPCION'
};
