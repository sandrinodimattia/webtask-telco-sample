//
//  HomeViewController.swift
//  SwiftSample
//
//  Created by Hernan Zalazar on 10/2/14.
//  Copyright (c) 2014 Auth0. All rights reserved.
//

import UIKit

class HomeViewController: UIViewController {
    
    var completeProfileUrl: String = ""
    @IBOutlet weak var textName: UILabel!
    @IBOutlet weak var textEmail: UILabel!
    @IBOutlet weak var textHomeID: UILabel!
    @IBOutlet weak var textMobileID: UILabel!
    @IBOutlet weak var profileImage: UIImageView!
    
    @IBOutlet weak var logoutButton: UINavigationItem!
    
    override func viewDidLoad() {
        super.viewDidLoad()
    }
    
    /*
     * If the user is logged in, show the profile.
     * If not, show the login page.
     */
    override func viewWillAppear(animated: Bool) {
        let keychain = MyApplication.sharedInstance.keychain
        let idToken = keychain.stringForKey("id_token")
        if (idToken != nil) {
            println("ID token: " + idToken)
            
            if (!A0JWTDecoder.isJWTExpired(idToken)) {
                let keychain = MyApplication.sharedInstance.keychain
                let profileData:NSData! = keychain.dataForKey("profile")
                let profile:A0UserProfile = NSKeyedUnarchiver.unarchiveObjectWithData(profileData) as A0UserProfile
                
                self.profileImage?.sd_setImageWithURL(profile.picture)
                self.textName?.text = profile.name
                self.textEmail?.text = profile.email
                self.textHomeID?.text = profile.extraInfo["home_id"] as? String
                self.textMobileID?.text = profile.extraInfo["mobile_id"] as? String
                return
            }
        }
        
        showLogin()
    }
    
    /*
     * Pass the url to the CompleteProfileController.
     */
    override func prepareForSegue(segue: UIStoryboardSegue?, sender: AnyObject?) {
        if segue!.identifier == "completeProfile" {
            let viewController = segue!.destinationViewController as CompleteProfileController
            viewController.url = completeProfileUrl
        }
    }
    
    /*
     * Logout.
     */
    @IBAction func logoutClick(segue:UIStoryboardSegue) {
        logout(self)
    }
    
    /*
     * Logout.
     */
    @IBAction func logout(sender: AnyObject) {
        MyApplication.sharedInstance.keychain.clearAll()
        A0SimpleKeychain().clearAll()
        self.showLogin()
    }
    
    /*
     * Show the Lock
     */
    func showLogin() {
        // Customize theme.
        let theme = A0Theme()
        theme.registerColor(UIColor(red:102/255.0, green:185/255.0, blue:0/255.0, alpha:1.0), forKey: A0ThemePrimaryButtonNormalColor)
        theme.registerColor(UIColor(red:102/255.0, green:154/255.0, blue:0/255.0, alpha:1.0), forKey: A0ThemePrimaryButtonHighlightedColor)
        A0Theme.sharedInstance().registerTheme(theme)
        
        // Show Lock.
        let authController = A0LockViewController()
        authController.closable = false
        authController.authenticationParameters.scopes.append("mobile_id")
        authController.onAuthenticationBlock = {(profile:A0UserProfile!, token:A0Token!) -> () in

            // Need to complete profile?
            if let completeProfileUrl = profile.extraInfo["complete_profile_url"] as? String {
                println("Webtask Url: " + completeProfileUrl)
                
                self.completeProfileUrl = completeProfileUrl
                self.performSegueWithIdentifier("completeProfile", sender: self)
                self.dismissViewControllerAnimated(true, completion: nil)
                return
            }
            
            // User has a complete profile, store information.
            let keychain = MyApplication.sharedInstance.keychain
            keychain.setString(token.idToken, forKey: "id_token")
            keychain.setString(token.refreshToken, forKey: "refresh_token")
            keychain.setData(NSKeyedArchiver.archivedDataWithRootObject(profile), forKey: "profile")
            self.dismissViewControllerAnimated(true, completion: nil)
            return
        }
        self.presentViewController(authController, animated: false, completion: nil)
    }
}
