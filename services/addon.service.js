const pool = require('../config/db');

class AddonService {
    async getAllAddons() {
        const result = await pool.query(
            'SELECT * FROM addon_services ORDER BY category, name'
        );
        return result.rows;
    }

    async getAddonById(id) {
        const result = await pool.query(
            'SELECT * FROM addon_services WHERE addon_id = $1',
            [id]
        );
        return result.rows[0];
    }

    async upsertAddon(data) {
        const { addon_id, name, category, price, is_active } = data;
        
        if (addon_id) {
            const result = await pool.query(
                `UPDATE addon_services 
                 SET name = $1, category = $2, price = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
                 WHERE addon_id = $5
                 RETURNING *`,
                [name, category, price, is_active, addon_id]
            );
            return result.rows[0];
        } else {
            const result = await pool.query(
                `INSERT INTO addon_services (name, category, price, is_active)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [name, category, price, is_active]
            );
            return result.rows[0];
        }
    }

    async deleteAddon(id) {
        await pool.query('DELETE FROM addon_services WHERE addon_id = $1', [id]);
        return true;
    }
}

module.exports = new AddonService();
