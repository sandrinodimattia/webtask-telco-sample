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
        navigationController?.popToRootViewControllerAnimated(true)
    }
}
