import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();

// Configuração do __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_Key = process.env.DB_KEY;

mongoose.connect(DB_Key)
  .then(() => {
    console.log("Conectado ao MongoDB. Pronto para uso");
  })
  .catch(err => {
    console.error("Erro ao conectar ao banco", err);
    process.exit(1); // Encerra o processo em caso de falha na conexão
  });

app.use(express.static('public'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Definição do Schema de Usuário
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }
});
const User = mongoose.model('User', userSchema);

// Rota para obter todos os usuários
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id'); // Busca todos os usuários, retornando apenas username e _id
    res.json(users);
  } catch (error) {
    console.error("Erro ao buscar usuários", error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para criar um novo usuário
app.post('/api/users', async (req, res) => {
  const username = req.body.username;

  try {
    const existingUser = await User.findOne({ username: username });

    if (existingUser) {
      return res.status(400).json({ error: "Username já existe." });
    }

    const newUser = new User({ username: username });
    const savedUser = await newUser.save();

    res.json({
      username: savedUser.username,
      _id: savedUser._id
    });
  } catch (error) {
    console.error("Erro ao criar usuário", error);
    res.status(500).json({ error: error.message }); 
  }
});

const exerciseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

const Exercise = mongoose.model('Exercise', exerciseSchema);

// Rota para adicionar um exercício a um usuário
app.post('/api/users/:_id/exercises', async (req, res) => {
  const { description, duration, date } = req.body;
  const userId = req.params._id;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' }); // Alterado para 404
    }

    const durationNumber = parseInt(duration);
    if (isNaN(durationNumber)) {
      return res.status(400).json({ error: 'Duração inválida' });
    }

    const dateObject = date ? new Date(date) : undefined;
    if (date && isNaN(dateObject.getTime())) {
      return res.status(400).json({ error: 'Data inválida' });
    }

    const newExercise = new Exercise({
      description: description,
      duration: durationNumber,
      date: dateObject,
      user: userId
    });

    const savedExercise = await newExercise.save();

    res.json({
      username: user.username,
      description: savedExercise.description,
      duration: savedExercise.duration,
      date: savedExercise.date.toDateString(),
      _id: user._id
    });
  } catch (error) {
    console.error("Erro ao adicionar exercício", error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para obter os logs de exercícios de um usuário
app.get('/api/users/:_id/logs', async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    let query = { user: userId };

    if (from || to) {
      query.date = {};
      if (from) {
        query.date.$gte = new Date(from);
      }
      if (to) {
        query.date.$lte = new Date(to);
      }
    }

    const limitNumber = limit ? parseInt(limit) : undefined;

    let exercises = await Exercise.find(query)
      .limit(limitNumber)
      .select('description duration date -_id');

    exercises = exercises.map(exercise => ({
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    }));

    const count = exercises.length;

    res.json({
      _id: user._id,
      username: user.username,
      count: count,
      log: exercises
    });
  } catch (error) {
    console.error("Erro ao buscar logs de exercícios", error);
    res.status(500).json({ error: error.message });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
