//
//  CompleteProfileController.swift
//  TelcoMobile
//
//  Created by Sandrino Di Mattia on 18/03/15.
//  Copyright (c) 2015 Auth0. All rights reserved.
//

import UIKit

class UpdatedProfileController: UIViewController {
    
    @IBOutlet weak var continueButton: UIBarButtonItem!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        self.navigationItem.title = "Profile Updated"
        self.navigationItem.setHidesBackButton(true, animated: true)
    }
    
    @IBAction func continueClick(sender: AnyObject) {
        let client = A0APIClient.sharedClient()
        let jwt = MyApplication.sharedInstance.keychain.stringForKey("temp_id_token")

        client.fetchUserProfileWithIdToken(jwt,
            success: { (response) -> Void in
                
                // Store temp info.
                let keychain = MyApplication.sharedInstance.keychain
                keychain.setString(jwt, forKey: "id_token")
                keychain.setData(NSKeyedArchiver.archivedDataWithRootObject(response), forKey: "profile")
                
                // Navigate to root.
                self.navigationController?.popToRootViewControllerAnimated(true)
            },
            failure: { (error) -> Void in
                println("An error ocurred \(error)")
                let alert = UIAlertView(title: "Error", message: error.description, delegate: nil, cancelButtonTitle: "OK")
                alert.show()
        })
        
        
    }
}
