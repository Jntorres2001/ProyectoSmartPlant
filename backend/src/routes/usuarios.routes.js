const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

// GET /api/usuarios -> lista de usuarios (solo Administrador)
router.get('/', verificarToken, verificarRol(['Administrador']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, correo, rol, estado, avatar_iniciales, creado_en FROM usuarios ORDER BY creado_en DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios -> crear usuario (solo Administrador)
router.post('/', verificarToken, verificarRol(['Administrador']), async (req, res) => {
  const { nombre, correo, password, rol } = req.body;

  if (!nombre || !correo || !password || !rol) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const hashPassword = await bcrypt.hash(password, 10);
    const iniciales = nombre.split(' ').map((p) => p[0]).join('').substring(0, 2).toUpperCase();

    const [resultado] = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password, rol, avatar_iniciales) VALUES (?, ?, ?, ?, ?)`,
      [nombre, correo, hashPassword, rol, iniciales]
    );

    res.status(201).json({ id: resultado.insertId, nombre, correo, rol });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/usuarios/:id -> editar usuario
router.put('/:id', verificarToken, verificarRol(['Administrador']), async (req, res) => {
  const { nombre, correo, rol, estado } = req.body;

  try {
    await pool.query(
      `UPDATE usuarios SET nombre = ?, correo = ?, rol = ?, estado = ? WHERE id = ?`,
      [nombre, correo, rol, estado, req.params.id]
    );
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/usuarios/:id
router.delete('/:id', verificarToken, verificarRol(['Administrador']), async (req, res) => {
  try {
    await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// PUT /api/usuarios/perfil/mi-perfil -> el usuario edita su propio perfil
router.put('/perfil/mi-perfil', verificarToken, async (req, res) => {
  const { nombre, correo } = req.body;
  try {
    await pool.query('UPDATE usuarios SET nombre = ?, correo = ? WHERE id = ?', [
      nombre,
      correo,
      req.usuario.id
    ]);
    res.json({ mensaje: 'Perfil actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

module.exports = router;
