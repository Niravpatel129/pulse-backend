import Availability from '../../models/Availability.js';

const updateAvailabilitySettings = async (req, res) => {
  try {
    const { userId } = req.user;
    const settings = req.body;

    // Transform the availability slots to match the schema structure
    if (settings.availabilitySlots) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const transformedSlots = {};

      days.forEach((day) => {
        if (settings.availabilitySlots[day]) {
          transformedSlots[day] = {
            isEnabled:
              settings.availabilitySlots[day].isEnabled !== undefined
                ? settings.availabilitySlots[day].isEnabled
                : true,
            slots: settings.availabilitySlots[day].slots || settings.availabilitySlots[day],
          };
        } else {
          transformedSlots[day] = {
            isEnabled: true,
            slots: [{ start: '09:00', end: '17:00' }],
          };
        }
      });

      settings.availabilitySlots = transformedSlots;
    }

    const updatedAvailability = await Availability.findOneAndUpdate(
      { userId },
      { $set: settings },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );

    res.status(200).json(updatedAvailability);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export default updateAvailabilitySettings;
