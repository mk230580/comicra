// This is a MOCKED API service.
// In a real application, this would make fetch() calls to your backend.
import type { Page, Character, User, Plan } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

interface UserData {
    pages: Page[];
    characters: Character[];
    worldview: string;
    currentPageId: string | null;
}

// Mock user database
// In a real app, this would be a database table.
// We use 'let' so we can modify it with apiDeleteUser.
// Persist mock users to avoid losing signups on HMR/reloads
const USERS_STORAGE_KEY = 'comicra-mock-users';

let users: (User & {password: string})[] = [
    { id: 'admin-1', name: 'Admin User', email: 'admin@comicra.com', password: 'adminpassword', plan: 'premium', role: 'admin' },
    { id: 'user-1', name: 'Creator User', email: 'creator@comicra.com', password: 'password', plan: 'free', role: 'creator' },
    { id: 'user-2', name: 'Viewer User', email: 'viewer@comicra.com', password: 'password', plan: 'free', role: 'viewer' },
];

const loadUsers = () => {
    try {
        const raw = localStorage.getItem(USERS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                users = parsed;
            }
        }
    } catch {}
};

const saveUsers = () => {
    try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch {}
};

// Attempt to hydrate users on module load
loadUsers();

// Mock plans database
const plans: Plan[] = [
    { id: 'free', name: 'Free', price: '0', priceFrequency: 'month', features: ['5 Pages', '2 Characters', 'Basic AI Models'], isCurrent: false },
    { id: 'pro', name: 'Pro', price: '10', priceFrequency: 'month', features: ['50 Pages', '10 Characters', 'Advanced AI Models', 'Video Producer Access'], isCurrent: false },
    { id: 'premium', name: 'Premium', price: '25', priceFrequency: 'month', features: ['Unlimited Pages', 'Unlimited Characters', 'All AI Models', 'Video Producer Access', 'Priority Support'], isCurrent: false },
];


export const apiLogin = (email: string, password: string): Promise<AuthResponse> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const user = users.find(u => u.email === email);
      if (user && user.password === password) {
        const { password: _password, ...userWithoutPassword } = user;
        resolve({
          token: 'mock-jwt-token-' + Date.now(),
          user: userWithoutPassword
        });
      } else {
        reject(new Error('Invalid email or password.'));
      }
    }, 800);
  });
};

export const apiSignup = (name: string, email: string, password: string): Promise<AuthResponse> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (users.some(u => u.email === email)) {
        reject(new Error('An account with this email already exists.'));
      } else {
        const newUser: User & { password: string } = { 
            id: Date.now().toString(), 
            name, 
            email, 
            password, 
            plan: 'free', 
            role: 'creator' // Default role for new signups
        };
        users.push(newUser);
        saveUsers();
        
        localStorage.setItem(`comicra-userdata-${newUser.id}`, JSON.stringify({
            pages: [],
            characters: [],
            worldview: '',
            currentPageId: null,
        }));
        
        const { password: _password, ...userWithoutPassword } = newUser;
        resolve({
          token: 'mock-jwt-token-' + Date.now(),
          user: userWithoutPassword
        });
      }
    }, 800);
  });
};


// In a real app, you'd pass the token to authorize the request
export const fetchUserData = (userId: string): Promise<UserData> => {
    console.log(`MOCK API: Fetching data for user ${userId}`);
    return new Promise((resolve) => {
        setTimeout(() => {
            const data = localStorage.getItem(`comicra-userdata-${userId}`);
            if (data) {
                resolve(JSON.parse(data));
            } else {
                resolve({
                    pages: [],
                    characters: [],
                    worldview: '',
                    currentPageId: null,
                });
            }
        }, 600);
    });
};

export const saveUserData = (userId: string, data: UserData): Promise<{ success: boolean }> => {
    console.log(`MOCK API: Saving data for user ${userId}`);
    return new Promise((resolve) => {
        setTimeout(() => {
            // localStorage has a very small quota (~5-10MB). The app holds large base64 images.
            // For the mock implementation, strip bulky base64 fields before saving.
            const sanitized: UserData = {
                ...data,
                pages: (data.pages || []).map(p => ({
                    ...p,
                    panelLayoutImage: null,
                    assistantProposalImage: null,
                    generatedImage: null,
                    generatedText: null,
                    // Also clear any image hrefs inside shapes to keep storage tiny
                    shapes: (p.shapes || []).map(s => s.type === 'image' ? { ...s, href: '' } as any : s),
                })),
                characters: (data.characters || []).map(c => ({
                    ...c,
                    // Do not persist heavy images to localStorage in mock mode
                    sheetImage: '',
                    referenceImages: [],
                })),
            };

            try {
                localStorage.setItem(`comicra-userdata-${userId}`, JSON.stringify(sanitized));
            } catch (e) {
                console.warn('localStorage quota exceeded; falling back to minimal save');
                // Last resort: save only IDs and names to avoid app breakage
                const minimal: UserData = {
                    pages: sanitized.pages.map(p => ({ id: p.id, name: p.name, shapes: [], shapesHistory: [[]], shapesHistoryIndex: 0, panelLayoutImage: null, sceneDescription: p.sceneDescription || '', panelCharacterMap: {}, generatedImage: null, generatedText: null, generatedColorMode: null, aspectRatio: p.aspectRatio, viewTransform: p.viewTransform, shouldReferencePrevious: p.shouldReferencePrevious, assistantProposalImage: null, proposalOpacity: p.proposalOpacity, isProposalVisible: p.isProposalVisible, proposedShapes: null } as any)),
                    characters: sanitized.characters.map(c => ({ id: c.id, name: c.name, referenceImages: [], sheetImage: '', description: c.description })),
                    worldview: sanitized.worldview,
                    currentPageId: sanitized.currentPageId,
                };
                try {
                    localStorage.setItem(`comicra-userdata-${userId}`, JSON.stringify(minimal));
                } catch {
                    // Give up silently in mock mode
                }
            }
            resolve({ success: true });
        }, 300);
    });
};


// --- Subscription Mocks ---

export const apiGetPlans = (currentUserPlan: 'free' | 'pro' | 'premium'): Promise<Plan[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const planHierarchy = { free: 0, pro: 1, premium: 2 };
            const currentUserLevel = planHierarchy[currentUserPlan];
            
            const processedPlans = plans.map(p => ({
                ...p,
                isCurrent: p.id === currentUserPlan,
                isUpgrade: planHierarchy[p.id] > currentUserLevel
            }));
            resolve(processedPlans);
        }, 500);
    });
};

export const apiCreateCheckoutSession = (userId: string, planId: 'pro' | 'premium'): Promise<{ success: boolean, newUser: User }> => {
    console.log(`MOCK API: User ${userId} is upgrading to ${planId}`);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const userIndex = users.findIndex(u => u.id === userId);
            if (userIndex > -1) {
                const userToUpdate = users[userIndex];
                if(userToUpdate) {
                    userToUpdate.plan = planId;
                    const { password, ...userWithoutPassword } = userToUpdate;
                    
                    // Also update the user in localStorage for the auth context
                    localStorage.setItem('comicra-user', JSON.stringify(userWithoutPassword));
                    saveUsers();

                    resolve({ success: true, newUser: userWithoutPassword });
                }
            } else {
                reject(new Error("User not found"));
            }
        }, 1200);
    });
};

export const apiManageSubscription = (): Promise<{ portalUrl: string }> => {
    console.log("MOCK API: Requesting subscription management portal");
    return new Promise((resolve) => {
        setTimeout(() => {
            // In a real app, this would be a Stripe portal URL.
            // We can just alert the user for this mock.
            alert("This would open the Stripe customer portal where you can manage your subscription.");
            resolve({ portalUrl: '#' });
        }, 800);
    });
}

// --- Admin Mocks ---

export const apiGetAllUsers = (): Promise<User[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const usersWithoutPasswords = users.map(u => {
                const { password, ...user } = u;
                return user;
            });
            resolve(usersWithoutPasswords);
        }, 500);
    });
};

export const apiUpdateUser = (userId: string, data: Partial<Pick<User, 'role' | 'plan'>>): Promise<User> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const userIndex = users.findIndex(u => u.id === userId);
            if (userIndex > -1) {
                const userToUpdate = users[userIndex];
                if(userToUpdate) {
                    Object.assign(userToUpdate, data);
                    saveUsers();
                    const { password, ...updatedUser } = userToUpdate;
                    resolve(updatedUser);
                }
            } else {
                reject(new Error("User not found"));
            }
        }, 500);
    });
};

export const apiDeleteUser = (userId: string): Promise<{ success: boolean }> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const initialLength = users.length;
            users = users.filter(u => u.id !== userId);
            saveUsers();
            if (users.length < initialLength) {
                // Also remove user data
                localStorage.removeItem(`comicra-userdata-${userId}`);
                resolve({ success: true });
            } else {
                reject(new Error("User not found"));
            }
        }, 500);
    });
};