import EmailThread from '../../models/Email/EmailThreadModel.js';

const getInboxEmailById = async (req, res) => {
  try {
    const { id } = req.params;
    const email = await EmailThread.findById(id).populate('emails');
    res.status(200).json(email);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error at getInboxEmailById' });
  }
};

export default getInboxEmailById;
