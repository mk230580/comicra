import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiLogin, apiSignup } from '../services/apiService';
import { GoogleIcon, FacebookIcon } from './icons';

export function Auth() {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let response;
      if (isLoginView) {
        response = await apiLogin(email, password);
      } else {
        response = await apiSignup(name, email, password);
      }
      login(response.token, response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const toggleView = () => {
    setIsLoginView(!isLoginView);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
            <img src="/logo.png" alt="Comicra Logo" className="w-16 h-16 mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-gray-900">
                {isLoginView ? 'Welcome back to Comicra' : 'Create your Comicra account'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
                {isLoginView ? "Don't have an account?" : 'Already have an account?'}
                <button onClick={toggleView} className="font-medium text-indigo-600 hover:text-indigo-500 ml-1">
                {isLoginView ? 'Sign up' : 'Log in'}
                </button>
            </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {!isLoginView && (
            <div>
              <label htmlFor="name" className="text-sm font-medium text-gray-700 sr-only">Name</label>
              <input id="name" name="name" type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="Your Name"
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
            </div>
          )}
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-700 sr-only">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
          </div>
          <div>
            <label htmlFor="password"className="text-sm font-medium text-gray-700 sr-only">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
          </div>
          {error && <p className="text-sm text-center text-red-600">{error}</p>}
          <div>
            <button type="submit" disabled={loading}
              className="flex justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">
              {loading ? 'Processing...' : (isLoginView ? 'Log in' : 'Sign up')}
            </button>
          </div>
        </form>

        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-xs text-gray-400 uppercase">Or continue with</span>
            <div className="flex-grow border-t border-gray-200"></div>
        </div>
        <div className="space-y-3">
            <button
                type="button"
                disabled
                title="Google Login Coming Soon"
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <GoogleIcon className="w-5 h-5 mr-3" />
                Sign in with Google
            </button>
            <button
                type="button"
                disabled
                title="Facebook Login Coming Soon"
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <FacebookIcon className="w-5 h-5 mr-3" />
                Sign in with Facebook
            </button>
        </div>

      </div>
    </div>
  );
}