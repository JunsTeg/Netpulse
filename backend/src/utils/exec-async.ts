import { promisify } from 'util';
import { exec } from 'child_process';

// Fonction pour executer des commandes shell de maniere asynchrone
export const execAsync = promisify(exec);

// Fonction pour executer une commande et retourner la sortie standard
export const execCommand = async (command: string): Promise<string> => {
  try {
    const { stdout } = await execAsync(command);
    return stdout.trim();
  } catch (error) {
    console.error(`Erreur lors de l'execution de la commande: ${command}`, error);
    throw error;
  }
};

// Fonction pour executer une commande et retourner la sortie en JSON
export const execCommandJson = async <T>(command: string): Promise<T> => {
  try {
    const { stdout } = await execAsync(command);
    return JSON.parse(stdout.trim()) as T;
  } catch (error) {
    console.error(`Erreur lors de l'execution de la commande JSON: ${command}`, error);
    throw error;
  }
}; 