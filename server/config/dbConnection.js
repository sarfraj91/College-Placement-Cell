import mongoose from 'mongoose';
import dotenv from 'dotenv';    
import User from '../models/userModel.js';

dotenv.config();
mongoose.set('strictQuery', true);

const repairUserRollNoIndex = async () => {
    const indexes = await User.collection.indexes();
    const rollNoIndex = indexes.find((index) => index.name === 'rollNo_1');
    const hasCorrectPartialIndex =
        rollNoIndex?.unique === true &&
        rollNoIndex?.partialFilterExpression?.rollNo?.$type === 'number';

    if (rollNoIndex && !hasCorrectPartialIndex) {
        await User.collection.dropIndex('rollNo_1');
        console.log('Recreated stale rollNo unique index with partial filter');
    }

    if (!rollNoIndex || !hasCorrectPartialIndex) {
        await User.collection.createIndex(
            { rollNo: 1 },
            {
                name: 'rollNo_1',
                unique: true,
                partialFilterExpression: { rollNo: { $type: 'number' } },
            },
        );
    }
};

const connectDB = async () => { 
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            
        });
        await repairUserRollNoIndex();
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }   
};

export default connectDB;
