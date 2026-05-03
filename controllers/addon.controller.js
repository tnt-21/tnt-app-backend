const addonService = require('../services/addon.service');

const getAllAddons = async (req, res) => {
    try {
        const addons = await addonService.getAllAddons();
        res.status(200).json({
            success: true,
            data: addons
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const upsertAddon = async (req, res) => {
    try {
        const addon = await addonService.upsertAddon(req.body);
        res.status(200).json({
            success: true,
            data: addon
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteAddon = async (req, res) => {
    try {
        await addonService.deleteAddon(req.params.id);
        res.status(200).json({
            success: true,
            message: 'Add-on deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getAllAddons,
    upsertAddon,
    deleteAddon
};
