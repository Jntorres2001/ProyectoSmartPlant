-- ============================================
-- SmartPlant IoT Monitor - Esquema de Base de Datos
-- ============================================

CREATE DATABASE IF NOT EXISTS smartplant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smartplant;

-- ----------------------------------------
-- Tabla: usuarios
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NULL,            -- NULL si el usuario solo usa Google OAuth
    google_id VARCHAR(100) NULL UNIQUE,
    rol ENUM('Administrador', 'Tecnico', 'Visualizador') NOT NULL DEFAULT 'Visualizador',
    estado ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
    avatar_iniciales VARCHAR(5) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ----------------------------------------
-- Tabla: dispositivos (ESP32)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS dispositivos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_dispositivo VARCHAR(100) NOT NULL UNIQUE,   -- ej. ESP32-Jardin-01
    api_key VARCHAR(64) NOT NULL UNIQUE,               -- clave que usa el ESP32 para autenticarse
    ssid VARCHAR(100) NULL,
    intervalo_lectura_segundos INT DEFAULT 30,
    humedad_minima_alerta DECIMAL(5,2) DEFAULT 35.00,
    riego_automatico BOOLEAN DEFAULT TRUE,
    estado ENUM('Conectado', 'Desconectado') DEFAULT 'Desconectado',
    ultima_conexion TIMESTAMP NULL,
    usuario_id INT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ----------------------------------------
-- Tabla: lecturas (historial de humedad — sensor capacitivo del ESP32)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS lecturas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    dispositivo_id INT NOT NULL,
    humedad DECIMAL(5,2) NOT NULL,
    voltaje DECIMAL(4,2) NULL,
    senal_wifi INT NULL,                  -- en dBm
    estado_planta ENUM('Saludable', 'Necesita agua', 'Critico') DEFAULT 'Saludable',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE,
    INDEX idx_dispositivo_fecha (dispositivo_id, creado_en)
);

-- ----------------------------------------
-- Tabla: alertas
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS alertas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dispositivo_id INT NOT NULL,
    tipo ENUM('Error', 'Advertencia', 'Correcta', 'Info') NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    leida BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE
);

-- ----------------------------------------
-- Tabla: configuracion de notificaciones por usuario
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones_config (
    usuario_id INT PRIMARY KEY,
    correo BOOLEAN DEFAULT TRUE,
    push BOOLEAN DEFAULT TRUE,
    sms BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ----------------------------------------
-- Columnas nuevas en usuarios (verificación OTP + estado Premium)
-- ----------------------------------------
ALTER TABLE usuarios ADD COLUMN correo_verificado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN es_premium BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN premium_hasta TIMESTAMP NULL;

-- ----------------------------------------
-- Tabla: otp_codigos (verificación de cuenta por correo)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS otp_codigos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    codigo VARCHAR(6) NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    expira_en TIMESTAMP NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario_otp (usuario_id, codigo)
);

-- ----------------------------------------
-- Tabla: password_resets (recuperación de contraseña)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    usado BOOLEAN DEFAULT FALSE,
    expira_en TIMESTAMP NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_token (token)
);

-- ----------------------------------------
-- Tabla: cola_correos (cola interna de envío de emails, sin Redis/RabbitMQ)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS cola_correos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    destinatario VARCHAR(150) NOT NULL,
    asunto VARCHAR(200) NOT NULL,
    tipo ENUM('OTP', 'RECUPERACION', 'ALERTA', 'REPORTE', 'PREMIUM', 'GENERAL') NOT NULL DEFAULT 'GENERAL',
    cuerpo_html LONGTEXT NOT NULL,
    adjuntos JSON NULL,
    estado ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    intentos INT NOT NULL DEFAULT 0,
    error TEXT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_estado (estado)
);

-- ----------------------------------------
-- Tabla: suscripciones (estado Premium del usuario)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS suscripciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    plan ENUM('Free', 'Premium') NOT NULL DEFAULT 'Free',
    proveedor_pago ENUM('PayPhone', 'PayPal') NULL,
    fecha_inicio TIMESTAMP NULL,
    fecha_fin TIMESTAMP NULL,
    activa BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ----------------------------------------
-- Tabla: transacciones_pago (PayPhone / PayPal)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS transacciones_pago (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    proveedor ENUM('PayPhone', 'PayPal') NOT NULL,
    referencia_externa VARCHAR(150) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    moneda VARCHAR(10) DEFAULT 'USD',
    estado ENUM('Iniciada', 'Aprobada', 'Rechazada', 'Fallida') NOT NULL DEFAULT 'Iniciada',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_referencia (referencia_externa)
);

-- ----------------------------------------
-- Elimina la columna de temperatura (el hardware solo tiene sensor
-- capacitivo de humedad, nunca hubo un sensor de temperatura real).
-- Si tu base de datos es nueva (creada con el CREATE TABLE de arriba),
-- esta columna ya no existe y esta línea fallará — es esperado, ignórala.
-- ----------------------------------------
ALTER TABLE lecturas DROP COLUMN temperatura;

-- ----------------------------------------
-- Tabla: diagnosticos_ia (historial de diagnósticos y recomendaciones
-- generados por el Asistente IA, tanto manuales como automáticos)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS diagnosticos_ia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    dispositivo_id INT NOT NULL,
    tipo ENUM('manual', 'automatica') NOT NULL DEFAULT 'manual',
    diagnostico TEXT NOT NULL,
    recomendaciones TEXT NULL,
    tendencia VARCHAR(30) NULL,           -- 'Aumentando' | 'Disminuyendo' | 'Estable'
    humedad_actual DECIMAL(5,2) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE,
    INDEX idx_usuario_fecha (usuario_id, creado_en)
);

-- ----------------------------------------
-- Datos iniciales de ejemplo
-- ----------------------------------------
INSERT INTO dispositivos (nombre_dispositivo, api_key, ssid, humedad_minima_alerta, riego_automatico, estado)
VALUES ('ESP32-Jardin-01', 'sp_demo_apikey_cambiala_123456', 'SmartPlant_Network', 35.00, TRUE, 'Desconectado')
ON DUPLICATE KEY UPDATE nombre_dispositivo = nombre_dispositivo;
